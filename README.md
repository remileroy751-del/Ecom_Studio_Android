# EcomVideoStudio pour Android — version 1.1.0 (montage + Mode IA)

Application Android (APK) basée sur **EcomVideoStudio COMMERCIAL V2.0** (Windows) : même moteur de montage, mêmes fonctions.

## Inclus
- **Montage manuel** : pistes V1–V3 + CC + audio, couper, effets, transitions, textes, stickers, export MP4 (9:16, 16:9, 4:5, 1:1 ; 1080p / 720p / 480p).
- Mises à jour V2.0 : **Couper** (touche K), **Annuler / Rétablir** (Ctrl+Z), **Actualiser** renforcé, export avec réessais automatiques, voix off **MP3 et MPEG**.
- **Mode IA** : voix off à partir d'un script (voix du téléphone hors ligne, ou voix Gemini), montage automatique d'un short 9:16, sous-titres.
- **Légendes automatiques** (Groq Whisper, Gemini, Mistral, OpenAI, Deepgram).
- Licence : essai de 14 jours, clés de 30 jours.
- Les vidéos exportées sont enregistrées dans la galerie : **Films › EcomVideoStudio**.

## Obtenir l'APK
1. Dépôt GitHub **privé** : envoyez-y le contenu de ce dossier (`package.json` à la racine).
2. **Clés Groq (légendes + IA)** : dépôt → *Settings* → *Secrets and variables* → *Actions* → *New repository secret*.
   Nom : `GROQ_API_KEYS` — valeur : vos clés `gsk_…` séparées par une virgule ou un retour à la ligne.
   Elles sont ajoutées à l'APK à la compilation (jamais écrites dans le code du dépôt) et utilisées à tour de rôle : si l'une atteint son quota, l'application passe à la suivante.
   Sans ce secret, l'application fonctionne quand même : l'utilisateur colle sa clé dans l'onglet Légendes.
3. Onglet **Actions** → « Build EcomVideoStudio Android (APK) » (démarre à chaque envoi, ou « Run workflow »).
4. Téléchargez l'APK dans **Artifacts**, copiez-le sur le téléphone et installez-le (par-dessus l'ancienne version, sans désinstaller).

## Bon à savoir
- Les clés intégrées à une application peuvent être extraites par quelqu'un de motivé : ne mettez que des clés gratuites que vous pouvez régénérer, et ne partagez pas l'APK publiquement.
- **Voix off IA** : Groq ne propose pas de voix françaises. L'application utilise la synthèse vocale du téléphone (hors ligne ; si aucune voix française n'est installée : Paramètres › Langues › Synthèse vocale) ou les voix Gemini (clé Gemini à saisir dans l'onglet Légendes).
- Téléphones **arm64** (quasi tous les Android récents), Android 7.0 minimum, **mode paysage**.
- Encodage : H.264 matériel du téléphone (MediaCodec) ; bascule automatique sur un autre encodeur si nécessaire.
- Bibliothèque FFmpeg : `com.mrljdx:ffmpeg-kit-full:6.1.4`. Si la compilation échoue sur cette ligne, « Run workflow » permet d'en indiquer une autre (champ `ffmpeg_dep`), ou envoyez-moi le journal d'erreur.
