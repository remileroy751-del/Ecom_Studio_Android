package com.ecomacademy.ecomvideostudio;

import android.app.Activity;
import android.content.ClipData;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.database.Cursor;
import android.net.Uri;
import android.os.Bundle;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.speech.tts.Voice;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.provider.OpenableColumns;
import android.provider.Settings;
import android.util.Base64;
import android.webkit.MimeTypeMap;

import androidx.activity.result.ActivityResult;

import com.arthenica.ffmpegkit.FFmpegKit;
import com.arthenica.ffmpegkit.FFmpegKitConfig;
import com.arthenica.ffmpegkit.FFmpegSession;
import com.arthenica.ffmpegkit.ReturnCode;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Pont natif d'EcomVideoStudio : fichiers, import des médias, FFmpeg natif, enregistrement dans la galerie.
 * L'interface (WebView) l'appelle via window.ecom (src/bridge.js).
 */
@CapacitorPlugin(name = "EcomNative")
public class EcomPlugin extends Plugin {

    private final ExecutorService io = Executors.newFixedThreadPool(3);
    private final Map<String, LogBuf> logs = new ConcurrentHashMap<>();

    /** Journal FFmpeg d'une session (borné), lu par l'interface pour afficher la progression. */
    static class LogBuf {
        private final StringBuilder sb = new StringBuilder();
        private long dropped = 0;

        synchronized void add(String s) {
            if (s == null) return;
            sb.append(s);
            if (sb.length() > 300000) {
                int cut = sb.length() - 200000;
                sb.delete(0, cut);
                dropped += cut;
            }
        }

        synchronized String since(long off, long[] newOff) {
            long end = dropped + sb.length();
            int from = (int) Math.max(0, off - dropped);
            newOff[0] = end;
            return sb.substring(Math.min(from, sb.length()));
        }

        synchronized String all() {
            return sb.toString();
        }
    }

    private static String fmtTime(double ms) {
        if (ms < 0) ms = 0;
        long cs = (long) (ms / 10.0);
        long h = cs / 360000, m = (cs % 360000) / 6000, s = (cs % 6000) / 100, c = cs % 100;
        return String.format(Locale.US, "%02d:%02d:%02d.%02d", h, m, s, c);
    }

    private static String[] toStrings(JSArray arr) throws Exception {
        String[] out = new String[arr.length()];
        for (int i = 0; i < out.length; i++) out[i] = String.valueOf(arr.get(i));
        return out;
    }

    private static void copyStream(InputStream in, OutputStream out) throws Exception {
        byte[] buf = new byte[256 * 1024];
        int n;
        while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
        out.flush();
    }

    private static void deleteRec(File f) {
        if (f == null || !f.exists()) return;
        if (f.isDirectory()) {
            File[] kids = f.listFiles();
            if (kids != null) for (File k : kids) deleteRec(k);
        }
        //noinspection ResultOfMethodCallIgnored
        f.delete();
    }

    private static void writeBytesAtomic(File dest, byte[] data) throws Exception {
        File dir = dest.getParentFile();
        if (dir != null) dir.mkdirs();
        File tmp = new File(dest.getPath() + ".tmp");
        try (FileOutputStream o = new FileOutputStream(tmp)) {
            o.write(data);
            o.flush();
        }
        if (dest.exists()) dest.delete();
        if (!tmp.renameTo(dest)) {
            try (FileOutputStream o = new FileOutputStream(dest)) {
                o.write(data);
            }
            tmp.delete();
        }
    }

    private static byte[] readAll(File f) throws Exception {
        try (FileInputStream in = new FileInputStream(f); ByteArrayOutputStream bo = new ByteArrayOutputStream()) {
            copyStream(in, bo);
            return bo.toByteArray();
        }
    }

    private void copyAssetDir(String assetPath, File dest) {
        try {
            String[] names = getContext().getAssets().list(assetPath);
            if (names == null) return;
            dest.mkdirs();
            for (String n : names) {
                String sub = assetPath + "/" + n;
                String[] kids = getContext().getAssets().list(sub);
                if (kids != null && kids.length > 0) {
                    copyAssetDir(sub, new File(dest, n));
                } else {
                    try (InputStream in = getContext().getAssets().open(sub); FileOutputStream out = new FileOutputStream(new File(dest, n))) {
                        copyStream(in, out);
                    }
                }
            }
        } catch (Exception e) {
            // ressource manquante : l'interface continuera sans
        }
    }

    // ------------------------------------------------------------------ initialisation

    @PluginMethod
    public void setup(final PluginCall call) {
        io.execute(() -> {
            try {
                Context ctx = getContext();
                File base = new File(ctx.getFilesDir(), "EcomVideoStudio");
                for (String s : new String[]{"Projets", "media", "proxies", "logs", "assets"}) new File(base, s).mkdirs();
                File cache = ctx.getCacheDir();
                new File(cache, "exports").mkdirs();
                // Stickers et effets : copiés hors de l'APK (FFmpeg a besoin de vrais fichiers), recopiés après chaque mise à jour
                File assets = new File(base, "assets");
                String stamp = "0";
                try {
                    PackageInfo pi = ctx.getPackageManager().getPackageInfo(ctx.getPackageName(), 0);
                    stamp = String.valueOf(pi.lastUpdateTime);
                } catch (Exception ignored) {
                }
                File marker = new File(assets, ".stamp");
                String old = "";
                try {
                    if (marker.exists()) old = new String(readAll(marker), StandardCharsets.UTF_8);
                } catch (Exception ignored) {
                }
                if (!stamp.equals(old) || !new File(assets, "stickers").isDirectory() || !new File(assets, "effects").isDirectory()) {
                    copyAssetDir("public/stickers", new File(assets, "stickers"));
                    copyAssetDir("public/effects", new File(assets, "effects"));
                    writeBytesAtomic(marker, stamp.getBytes(StandardCharsets.UTF_8));
                }
                try {
                    FFmpegKitConfig.setFontDirectory(ctx, "/system/fonts", new HashMap<String, String>());
                } catch (Throwable ignored) {
                }
                JSObject r = new JSObject();
                r.put("base", base.getAbsolutePath());
                r.put("projets", new File(base, "Projets").getAbsolutePath());
                r.put("media", new File(base, "media").getAbsolutePath());
                r.put("proxies", new File(base, "proxies").getAbsolutePath());
                r.put("logs", new File(base, "logs").getAbsolutePath());
                r.put("stickers", new File(assets, "stickers").getAbsolutePath());
                r.put("effects", new File(assets, "effects").getAbsolutePath());
                r.put("cache", cache.getAbsolutePath());
                call.resolve(r);
            } catch (Exception e) {
                call.reject("setup: " + e.getMessage());
            }
        });
    }

    // ------------------------------------------------------------------ fichiers

    @PluginMethod
    public void stat(PluginCall call) {
        File f = new File(call.getString("path", ""));
        JSObject r = new JSObject();
        r.put("exists", f.exists());
        r.put("size", f.exists() ? f.length() : 0);
        r.put("mtime", f.exists() ? f.lastModified() : 0);
        call.resolve(r);
    }

    @PluginMethod
    public void exists(PluginCall call) {
        JSArray out = new JSArray();
        try {
            JSArray arr = call.getArray("paths", new JSArray());
            for (int i = 0; i < arr.length(); i++) out.put(new File(String.valueOf(arr.get(i))).exists());
        } catch (Exception ignored) {
        }
        JSObject r = new JSObject();
        r.put("list", out);
        call.resolve(r);
    }

    @PluginMethod
    public void mkTmp(PluginCall call) {
        File d = new File(getContext().getCacheDir(), "ecomvs-" + System.nanoTime());
        d.mkdirs();
        JSObject r = new JSObject();
        r.put("path", d.getAbsolutePath());
        call.resolve(r);
    }

    @PluginMethod
    public void readText(final PluginCall call) {
        io.execute(() -> {
            JSObject r = new JSObject();
            try {
                File f = new File(call.getString("path", ""));
                if (f.exists()) r.put("text", new String(readAll(f), StandardCharsets.UTF_8));
                else r.put("text", JSObject.NULL);
            } catch (Exception e) {
                r.put("text", JSObject.NULL);
            }
            call.resolve(r);
        });
    }

    @PluginMethod
    public void writeText(final PluginCall call) {
        io.execute(() -> {
            try {
                String text = call.getString("text", "");
                writeBytesAtomic(new File(call.getString("path", "")), text.getBytes(StandardCharsets.UTF_8));
                call.resolve();
            } catch (Exception e) {
                call.reject("writeText: " + e.getMessage());
            }
        });
    }

    @PluginMethod
    public void writeBase64(final PluginCall call) {
        io.execute(() -> {
            try {
                byte[] data = Base64.decode(call.getString("data", ""), Base64.DEFAULT);
                writeBytesAtomic(new File(call.getString("path", "")), data);
                call.resolve();
            } catch (Exception e) {
                call.reject("writeBase64: " + e.getMessage());
            }
        });
    }

    @PluginMethod
    public void deletePath(PluginCall call) {
        deleteRec(new File(call.getString("path", "")));
        call.resolve();
    }

    @PluginMethod
    public void rename(final PluginCall call) {
        io.execute(() -> {
            try {
                File from = new File(call.getString("from", "")), to = new File(call.getString("to", ""));
                if (to.exists()) to.delete();
                if (!from.renameTo(to)) {
                    try (FileInputStream in = new FileInputStream(from); FileOutputStream out = new FileOutputStream(to)) {
                        copyStream(in, out);
                    }
                    from.delete();
                }
                call.resolve();
            } catch (Exception e) {
                call.reject("rename: " + e.getMessage());
            }
        });
    }

    @PluginMethod
    public void listMeta(final PluginCall call) {
        io.execute(() -> {
            JSArray items = new JSArray();
            try {
                File[] files = new File(call.getString("dir", "")).listFiles();
                if (files != null) {
                    for (File f : files) {
                        if (f.getName().endsWith(".meta")) {
                            try {
                                items.put(new String(readAll(f), StandardCharsets.UTF_8));
                            } catch (Exception ignored) {
                            }
                        }
                    }
                }
            } catch (Exception ignored) {
            }
            JSObject r = new JSObject();
            r.put("items", items);
            call.resolve(r);
        });
    }

    @PluginMethod
    public void deviceId(PluginCall call) {
        JSObject r = new JSObject();
        String id = "";
        try {
            id = Settings.Secure.getString(getContext().getContentResolver(), Settings.Secure.ANDROID_ID);
        } catch (Exception ignored) {
        }
        r.put("id", id == null ? "" : id);
        call.resolve(r);
    }

    @PluginMethod
    public void openExternal(PluginCall call) {
        try {
            Uri u = Uri.parse(call.getString("url", ""));
            String host = u.getHost() == null ? "" : u.getHost().toLowerCase(Locale.ROOT);
            boolean ok = "https".equals(u.getScheme()) && host.matches("(.*\\.)?(whatsapp\\.com|mychariow\\.shop|chariow\\.com)");
            if (ok) {
                Intent i = new Intent(Intent.ACTION_VIEW, u);
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(i);
            }
        } catch (Exception ignored) {
        }
        call.resolve();
    }

    // ------------------------------------------------------------------ import des médias (sélecteur Android)

    @PluginMethod
    public void pickMedia(PluginCall call) {
        String kind = call.getString("kind", "all");
        Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        i.addCategory(Intent.CATEGORY_OPENABLE);
        i.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, !"audio".equals(kind));
        String[] types;
        if ("audio".equals(kind)) types = new String[]{"audio/*", "video/mpeg", "application/octet-stream"}; // mp3, mpeg, wav, m4a…
        else if ("visual".equals(kind)) types = new String[]{"image/*", "video/*"};
        else types = new String[]{"image/*", "video/*", "audio/*", "application/octet-stream"};
        i.setType("*/*");
        i.putExtra(Intent.EXTRA_MIME_TYPES, types);
        startActivityForResult(call, i, "pickResult");
    }

    @ActivityCallback
    private void pickResult(final PluginCall call, ActivityResult result) {
        if (call == null) return;
        final List<Uri> uris = new ArrayList<>();
        if (result != null && result.getResultCode() == Activity.RESULT_OK && result.getData() != null) {
            Intent d = result.getData();
            ClipData cd = d.getClipData();
            if (cd != null) {
                for (int k = 0; k < cd.getItemCount(); k++) uris.add(cd.getItemAt(k).getUri());
            } else if (d.getData() != null) {
                uris.add(d.getData());
            }
        }
        io.execute(() -> {
            JSArray files = new JSArray();
            Context ctx = getContext();
            ContentResolver cr = ctx.getContentResolver();
            File dir = new File(new File(ctx.getFilesDir(), "EcomVideoStudio"), "media");
            dir.mkdirs();
            int idx = 0;
            for (Uri u : uris) {
                try {
                    String name = "media";
                    try (Cursor c = cr.query(u, new String[]{OpenableColumns.DISPLAY_NAME}, null, null, null)) {
                        if (c != null && c.moveToFirst() && c.getString(0) != null) name = c.getString(0);
                    } catch (Exception ignored) {
                    }
                    name = name.replaceAll("[^A-Za-z0-9._-]", "_");
                    if (name.length() > 70) name = name.substring(name.length() - 70);
                    if (!name.contains(".")) {
                        String ext = MimeTypeMap.getSingleton().getExtensionFromMimeType(cr.getType(u));
                        name = name + "." + (ext == null ? "bin" : ext);
                    }
                    File dest = new File(dir, System.currentTimeMillis() + "_" + (idx++) + "_" + name);
                    try (InputStream in = cr.openInputStream(u); FileOutputStream out = new FileOutputStream(dest)) {
                        if (in == null) continue;
                        copyStream(in, out);
                    }
                    JSObject f = new JSObject();
                    f.put("path", dest.getAbsolutePath());
                    f.put("name", name);
                    files.put(f);
                } catch (Exception e) {
                    // fichier illisible : ignoré
                }
            }
            JSObject r = new JSObject();
            r.put("files", files);
            call.resolve(r);
        });
    }

    // ------------------------------------------------------------------ FFmpeg

    @PluginMethod
    public void runFF(final PluginCall call) {
        final String id = call.getString("id", "ff");
        final String[] args;
        try {
            args = toStrings(call.getArray("args", new JSArray()));
        } catch (Exception e) {
            call.reject("args invalides");
            return;
        }
        final LogBuf lb = new LogBuf();
        logs.put(id, lb);
        try {
            FFmpegKit.executeWithArgumentsAsync(args, session -> {
                JSObject r = new JSObject();
                ReturnCode rc = session.getReturnCode();
                r.put("code", rc == null ? -1 : rc.getValue());
                String out = lb.all();
                if (rc != null && rc.getValue() != 0 && out.trim().isEmpty()) {
                    try {
                        String fail = session.getFailStackTrace();
                        if (fail != null) out = fail;
                    } catch (Throwable ignored) {
                    }
                }
                r.put("output", out);
                call.resolve(r);
            }, log -> lb.add(log.getMessage()), stats -> lb.add("time=" + fmtTime((double) stats.getTime()) + "\n"));
        } catch (Throwable t) {
            JSObject r = new JSObject();
            r.put("code", -1);
            r.put("output", "FFmpeg indisponible : " + t);
            call.resolve(r);
        }
    }

    @PluginMethod
    public void pollLog(PluginCall call) {
        JSObject r = new JSObject();
        LogBuf lb = logs.get(call.getString("id", ""));
        long off = call.getData().optLong("offset", 0);
        if (lb == null) {
            r.put("text", "");
            r.put("offset", off);
        } else {
            long[] no = new long[1];
            r.put("text", lb.since(off, no));
            r.put("offset", no[0]);
        }
        call.resolve(r);
    }

    @PluginMethod
    public void clearLog(PluginCall call) {
        logs.remove(call.getString("id", ""));
        call.resolve();
    }

    @PluginMethod
    public void cancelFF(PluginCall call) {
        try {
            FFmpegKit.cancel();
        } catch (Throwable ignored) {
        }
        call.resolve();
    }

    @PluginMethod
    public void thumb(final PluginCall call) {
        io.execute(() -> {
            JSObject r = new JSObject();
            r.put("data", "");
            File out = new File(getContext().getCacheDir(), "thumb_" + System.nanoTime() + ".jpg");
            try {
                double dur = call.getData().optDouble("dur", 1);
                double ss = Math.max(0, Math.min(0.5, dur / 2));
                String[] a = {"-hide_banner", "-loglevel", "error", "-y", "-ss", String.format(Locale.US, "%.2f", ss), "-i", call.getString("file", ""),
                        "-frames:v", "1", "-vf", "scale=-2:72", "-q:v", "6", out.getAbsolutePath()};
                FFmpegSession s = FFmpegKit.executeWithArguments(a);
                if (out.exists() && out.length() > 0) {
                    r.put("data", "data:image/jpeg;base64," + Base64.encodeToString(readAll(out), Base64.NO_WRAP));
                }
            } catch (Throwable ignored) {
            } finally {
                //noinspection ResultOfMethodCallIgnored
                out.delete();
            }
            call.resolve(r);
        });
    }

    // ------------------------------------------------------------------ galerie

    @PluginMethod
    public void saveToGallery(final PluginCall call) {
        io.execute(() -> {
            JSObject r = new JSObject();
            r.put("ok", false);
            try {
                File src = new File(call.getString("path", ""));
                String name = call.getString("name", "EcomVideoStudio.mp4");
                if (!src.exists() || src.length() < 1000) {
                    call.resolve(r);
                    return;
                }
                Context ctx = getContext();
                if (Build.VERSION.SDK_INT >= 29) {
                    ContentResolver cr = ctx.getContentResolver();
                    ContentValues v = new ContentValues();
                    v.put(MediaStore.MediaColumns.DISPLAY_NAME, name);
                    v.put(MediaStore.MediaColumns.MIME_TYPE, "video/mp4");
                    v.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_MOVIES + "/EcomVideoStudio");
                    v.put(MediaStore.MediaColumns.IS_PENDING, 1);
                    Uri uri = cr.insert(MediaStore.Video.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY), v);
                    if (uri == null) {
                        call.resolve(r);
                        return;
                    }
                    try (InputStream in = new FileInputStream(src); OutputStream out = cr.openOutputStream(uri)) {
                        if (out == null) throw new Exception("flux de sortie indisponible");
                        copyStream(in, out);
                    }
                    ContentValues done = new ContentValues();
                    done.put(MediaStore.MediaColumns.IS_PENDING, 0);
                    cr.update(uri, done, null, null);
                    r.put("uri", uri.toString());
                    r.put("display", "Films/EcomVideoStudio/" + name);
                } else {
                    File dir = ctx.getExternalFilesDir(Environment.DIRECTORY_MOVIES);
                    if (dir == null) dir = new File(ctx.getFilesDir(), "Exports");
                    dir.mkdirs();
                    File dest = new File(dir, name);
                    try (InputStream in = new FileInputStream(src); FileOutputStream out = new FileOutputStream(dest)) {
                        copyStream(in, out);
                    }
                    r.put("uri", "");
                    r.put("display", dest.getAbsolutePath());
                }
                //noinspection ResultOfMethodCallIgnored
                src.delete();
                r.put("ok", true);
            } catch (Exception e) {
                r.put("ok", false);
                r.put("error", String.valueOf(e.getMessage()));
            }
            call.resolve(r);
        });
    }

    @PluginMethod
    public void openVideo(PluginCall call) {
        try {
            String u = call.getString("uri", "");
            if (!u.isEmpty()) {
                Intent i = new Intent(Intent.ACTION_VIEW);
                i.setDataAndType(Uri.parse(u), "video/mp4");
                i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(i);
            }
        } catch (Exception ignored) {
        }
        call.resolve();
    }

    // ------------------------------------------------------------------ dossier

    @PluginMethod
    public void listDir(PluginCall call) {
        JSArray names = new JSArray();
        File[] files = new File(call.getString("dir", "")).listFiles();
        if (files != null) {
            List<String> l = new ArrayList<>();
            for (File f : files) l.add(f.getName());
            java.util.Collections.sort(l);
            for (String n : l) names.put(n);
        }
        JSObject r = new JSObject();
        r.put("names", names);
        call.resolve(r);
    }

    // ------------------------------------------------------------------ réseau (hors WebView : pas de limite CORS)

    /**
     * Requête HTTPS POST. Corps : bodyText (JSON), bodyFile (+contentType) ou multipart {fields:[{name,value}], file:{field,path,filename,type}}.
     * Retourne {status, text}.
     */
    @PluginMethod
    public void httpRequest(final PluginCall call) {
        io.execute(() -> {
            JSObject r = new JSObject();
            HttpURLConnection c = null;
            try {
                URL url = new URL(call.getString("url", ""));
                if (!"https".equals(url.getProtocol())) throw new Exception("HTTPS requis");
                c = (HttpURLConnection) url.openConnection();
                c.setRequestMethod("POST");
                c.setConnectTimeout(30000);
                c.setReadTimeout(300000);
                c.setDoOutput(true);
                JSObject headers = call.getObject("headers");
                if (headers != null) {
                    Iterator<String> it = headers.keys();
                    while (it.hasNext()) {
                        String k = it.next();
                        c.setRequestProperty(k, headers.getString(k));
                    }
                }
                String bodyText = call.getString("bodyText");
                String bodyFile = call.getString("bodyFile");
                JSObject mp = call.getObject("multipart");
                if (mp != null) {
                    String boundary = "----ecomvs" + System.nanoTime();
                    ByteArrayOutputStream head = new ByteArrayOutputStream();
                    org.json.JSONArray fields = mp.getJSONArray("fields");
                    for (int i = 0; i < fields.length(); i++) {
                        org.json.JSONObject f = fields.getJSONObject(i);
                        head.write(("--" + boundary + "\r\nContent-Disposition: form-data; name=\"" + f.getString("name") + "\"\r\n\r\n" + f.getString("value") + "\r\n").getBytes(StandardCharsets.UTF_8));
                    }
                    org.json.JSONObject fi = mp.getJSONObject("file");
                    head.write(("--" + boundary + "\r\nContent-Disposition: form-data; name=\"" + fi.getString("field") + "\"; filename=\"" + fi.getString("filename") + "\"\r\nContent-Type: " + fi.getString("type") + "\r\n\r\n").getBytes(StandardCharsets.UTF_8));
                    byte[] tail = ("\r\n--" + boundary + "--\r\n").getBytes(StandardCharsets.UTF_8);
                    File file = new File(fi.getString("path"));
                    c.setRequestProperty("Content-Type", "multipart/form-data; boundary=" + boundary);
                    c.setFixedLengthStreamingMode(head.size() + file.length() + tail.length);
                    try (OutputStream out = c.getOutputStream(); FileInputStream in = new FileInputStream(file)) {
                        out.write(head.toByteArray());
                        copyStream(in, out);
                        out.write(tail);
                        out.flush();
                    }
                } else if (bodyFile != null && !bodyFile.isEmpty()) {
                    File file = new File(bodyFile);
                    c.setFixedLengthStreamingMode(file.length());
                    try (OutputStream out = c.getOutputStream(); FileInputStream in = new FileInputStream(file)) {
                        copyStream(in, out);
                    }
                } else {
                    byte[] data = (bodyText == null ? "" : bodyText).getBytes(StandardCharsets.UTF_8);
                    c.setFixedLengthStreamingMode(data.length);
                    try (OutputStream out = c.getOutputStream()) {
                        out.write(data);
                        out.flush();
                    }
                }
                int status = c.getResponseCode();
                InputStream is = status >= 400 ? c.getErrorStream() : c.getInputStream();
                String text = "";
                if (is != null) {
                    try (ByteArrayOutputStream bo = new ByteArrayOutputStream()) {
                        copyStream(is, bo);
                        text = new String(bo.toByteArray(), StandardCharsets.UTF_8);
                    }
                }
                r.put("status", status);
                r.put("text", text);
            } catch (Exception e) {
                r.put("status", 0);
                r.put("text", "");
                r.put("error", String.valueOf(e.getMessage()));
            } finally {
                if (c != null) c.disconnect();
            }
            call.resolve(r);
        });
    }

    // ------------------------------------------------------------------ voix off : synthèse vocale d'Android (hors ligne)

    private TextToSpeech tts;
    private boolean ttsReady = false, ttsFailed = false;
    private final List<Runnable> ttsWaiting = new ArrayList<>();

    private void withTts(final Runnable job) {
        synchronized (ttsWaiting) {
            if (ttsReady) {
                io.execute(job);
                return;
            }
            if (ttsFailed) {
                io.execute(job);
                return;
            }
            ttsWaiting.add(job);
            if (tts == null) {
                tts = new TextToSpeech(getContext(), status -> {
                    List<Runnable> run;
                    synchronized (ttsWaiting) {
                        if (status == TextToSpeech.SUCCESS) ttsReady = true;
                        else ttsFailed = true;
                        run = new ArrayList<>(ttsWaiting);
                        ttsWaiting.clear();
                    }
                    for (Runnable x : run) io.execute(x);
                });
            }
        }
    }

    @PluginMethod
    public void ttsVoices(final PluginCall call) {
        withTts(() -> {
            JSObject r = new JSObject();
            JSArray arr = new JSArray();
            try {
                if (ttsReady && tts != null) {
                    Set<Voice> vs = tts.getVoices();
                    if (vs != null) {
                        for (Voice v : vs) {
                            if (v.isNetworkConnectionRequired()) continue;
                            JSObject o = new JSObject();
                            o.put("name", v.getName());
                            o.put("culture", v.getLocale().toLanguageTag());
                            o.put("gender", "");
                            arr.put(o);
                        }
                    }
                }
            } catch (Throwable ignored) {
            }
            r.put("ok", ttsReady);
            r.put("voices", arr);
            call.resolve(r);
        });
    }

    /** {text, lang:"fr"|"en", gender:"female"|"male", out:"/chemin.wav"} → {ok, voice, error} */
    @PluginMethod
    public void ttsSynth(final PluginCall call) {
        withTts(() -> {
            final JSObject r = new JSObject();
            r.put("ok", false);
            try {
                if (!ttsReady || tts == null) {
                    r.put("error", "NOVOICE");
                    call.resolve(r);
                    return;
                }
                String lang = call.getString("lang", "fr");
                Locale loc = "en".equals(lang) ? Locale.ENGLISH : Locale.FRENCH;
                int lr = tts.setLanguage(loc);
                if (lr == TextToSpeech.LANG_MISSING_DATA || lr == TextToSpeech.LANG_NOT_SUPPORTED) {
                    r.put("error", "NOVOICE");
                    call.resolve(r);
                    return;
                }
                // Voix hors ligne de bonne qualité dans la langue demandée, si disponible
                String voiceName = "";
                try {
                    Voice best = null;
                    Set<Voice> vs = tts.getVoices();
                    if (vs != null) {
                        for (Voice v : vs) {
                            if (v.isNetworkConnectionRequired() || !v.getLocale().getLanguage().equals(loc.getLanguage())) continue;
                            if (best == null || v.getQuality() > best.getQuality()) best = v;
                        }
                    }
                    if (best != null) {
                        tts.setVoice(best);
                        voiceName = best.getName();
                    }
                } catch (Throwable ignored) {
                }
                boolean male = "male".equals(call.getString("gender", "female"));
                tts.setPitch(male ? 0.75f : 1.1f);
                tts.setSpeechRate(1.0f);
                final File out = new File(call.getString("out", ""));
                final String vn = voiceName;
                final java.util.concurrent.CountDownLatch done = new java.util.concurrent.CountDownLatch(1);
                final boolean[] okFlag = {false};
                tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                    @Override
                    public void onStart(String utteranceId) {
                    }

                    @Override
                    public void onDone(String utteranceId) {
                        okFlag[0] = true;
                        done.countDown();
                    }

                    @Override
                    public void onError(String utteranceId) {
                        done.countDown();
                    }
                });
                if (out.exists()) out.delete();
                Bundle params = new Bundle();
                int rc = tts.synthesizeToFile(call.getString("text", ""), params, out, "ecomvs");
                if (rc != TextToSpeech.SUCCESS) {
                    r.put("error", "synthesizeToFile=" + rc);
                    call.resolve(r);
                    return;
                }
                if (!done.await(120, java.util.concurrent.TimeUnit.SECONDS) || !okFlag[0] || !out.exists() || out.length() < 100) {
                    r.put("error", "TTSFAIL");
                    call.resolve(r);
                    return;
                }
                r.put("ok", true);
                r.put("voice", vn);
            } catch (Throwable t) {
                r.put("error", String.valueOf(t.getMessage()));
            }
            call.resolve(r);
        });
    }

    @PluginMethod
    public void readBase64(final PluginCall call) {
        io.execute(() -> {
            JSObject r = new JSObject();
            try {
                r.put("data", Base64.encodeToString(readAll(new File(call.getString("path", ""))), Base64.NO_WRAP));
            } catch (Exception e) {
                r.put("data", "");
            }
            call.resolve(r);
        });
    }

    @PluginMethod
    public void mkdirs(PluginCall call) {
        new File(call.getString("path", "")).mkdirs();
        call.resolve();
    }
}
