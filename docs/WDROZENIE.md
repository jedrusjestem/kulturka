# Wdrożenie Kulturki – krok po kroku (0 zł)

Całość działa na darmowych planach:

| Element | Usługa | Darmowy limit | Uwagi |
|---|---|---|---|
| Strona (frontend) | **GitHub Pages** | bez limitu ruchu dla takiej skali | statyczna strona, nie „usypia” |
| Baza + logowanie + zdjęcia | **Supabase Free** | 500 MB bazy, 1 GB plików, 50 000 użytkowników | pauza po 7 dniach bez ruchu → mamy 2 „budziki” |
| Agendy i listy obecności | **Google Apps Script** na koncie komisji | limity Google dla kont prywatnych wystarczają z zapasem | bez weryfikacji OAuth, bez kluczy Google Cloud |

> ⚠️ **Najważniejsze:** wszystkie konta (GitHub, Supabase, Google) zakładaj na **wspólnym mailu komisji**, nie na prywatnym. Komisja zmienia się co roku – dostęp musi przechodzić na kolejny zarząd. Patrz `docs/PRZEKAZANIE.md`.

Szacowany czas: ok. 45 minut.

---

## Krok 1. Supabase (baza danych i logowanie)

1. Wejdź na <https://supabase.com> → **Start your project** → zaloguj się (np. przez GitHub komisji).
2. **New project**: nazwa `kulturka`, region **Central EU (Frankfurt)**, wygeneruj i zapisz hasło do bazy (w menedżerze haseł komisji).
3. Gdy projekt się utworzy: **SQL Editor → New query** → wklej całą zawartość pliku [`supabase/schema.sql`](../supabase/schema.sql) → **Run**. Powinno pokazać „Success”.
4. **Authentication → Sign In / Providers → Email**:
   - zostaw włączone *Email*,
   - **wyłącz „Confirm email”** – i tak każde konto zatwierdza zarząd, a darmowa wysyłka maili Supabase to tylko kilka wiadomości na godzinę. (Jeśli chcesz potwierdzanie maili, podłącz darmowy SMTP, np. Resend lub Brevo, w *Authentication → Emails → SMTP*.)
5. **Authentication → URL Configuration**:
   - *Site URL*: adres strony z kroku 2 (np. `https://twoj-login.github.io/kulturka/`),
   - *Redirect URLs*: dodaj ten sam adres oraz `http://localhost:5173/`.
6. **Project Settings → API Keys** – skopiuj:
   - **Project URL** (`https://xxxx.supabase.co`),
   - **publishable / anon key** – to klucz PUBLICZNY, trafi do aplikacji,
   - **secret / service_role key** – klucz TAJNY, tylko do Google Apps Script (krok 3). Nigdy nie wklejaj go do aplikacji ani do repozytorium.

## Krok 2. Strona na GitHub Pages

1. Utwórz repozytorium na GitHubie (np. `kulturka`, może być prywatne* lub publiczne) i wypchnij ten folder:
   ```bash
   git remote add origin https://github.com/LOGIN/kulturka.git
   git push -u origin main
   ```
   \*GitHub Pages z prywatnego repo wymaga płatnego planu – na darmowym koncie repo musi być **publiczne**. To bezpieczne: w kodzie nie ma żadnych tajnych kluczy (klucz publishable jest publiczny z założenia, dane chroni RLS w bazie).
2. W repozytorium: **Settings → Secrets and variables → Actions → New repository secret**:
   - `VITE_SUPABASE_URL` = Project URL,
   - `VITE_SUPABASE_ANON_KEY` = publishable/anon key.
3. **Settings → Pages → Build and deployment → Source: GitHub Actions**.
4. **Actions → Deploy na GitHub Pages → Run workflow** (albo zrób dowolny push). Po ~1 min strona będzie pod `https://LOGIN.github.io/kulturka/`.
5. Wróć do Supabase (krok 1.5) i upewnij się, że ten adres jest w *Site URL* i *Redirect URLs*.

**Pierwsze konto:** wejdź na stronę → *Zarejestruj się*. **Pierwsza zarejestrowana osoba automatycznie zostaje przewodniczącym** (administratorem). Kolejne osoby czekają na akceptację zarządu.

> Alternatywa: Cloudflare Pages (też darmowe, działa z prywatnym repo). *Workers & Pages → Create → Pages → Connect to Git*, build command `npm run build`, output `dist`, zmienne środowiskowe jak wyżej.

## Krok 3. Google – agendy (Docs) i listy obecności (Sheets)

Instrukcja w [`docs/GOOGLE.md`](GOOGLE.md). W skrócie: skrypt Apps Script na koncie Google komisji co 5 minut tworzy agendy i arkusze obecności w wybranym folderze Drive.

## Krok 4. Ustawienia w aplikacji

Zaloguj się jako przewodniczący → **Panel zarządu → Google i ustawienia**:
- **Dozwolona domena e-mail**: `student.pwr.edu.pl` (zalecane – blokuje przypadkowe rejestracje),
- **Folder Google Drive**: link do folderu komisji,
- **Adres Apps Script**: URL wdrożenia z `docs/GOOGLE.md`.

## Krok 5. Telefon – instalacja jak aplikacja

Członkowie otwierają stronę w telefonie i wybierają:
- **Android / Chrome**: menu ⋮ → *Zainstaluj aplikację* / *Dodaj do ekranu głównego*,
- **iPhone / Safari**: przycisk *Udostępnij* → *Do ekranu początkowego*.

Zainstalowana aplikacja otwiera się na pełnym ekranie, bez paska przeglądarki, w orientacji pionowej.

---

## Rozwój lokalny

```bash
npm install
```
```bash
npm run dev
```
Bez pliku `.env` aplikacja uruchamia się w **trybie DEMO** (przykładowe dane w przeglądarce, szybkie logowanie jako różne role). Z plikiem `.env` (wzór: `.env.example`) łączy się z prawdziwą bazą.

## Ograniczenia, o których warto wiedzieć

- **Blokada obrotu**: przeglądarki nie pozwalają stronie całkowicie zablokować obrotu. Zainstalowana aplikacja (PWA) na Androidzie trzyma pion; w zwykłej przeglądarce i na iPhonie w poziomie pokazuje się plansza „Obróć telefon pionowo”.
- **Blokada przybliżania**: wyłączona w meta-tagu i dodatkowo blokowana gestami na iOS. Bardzo stare przeglądarki mogą to ignorować.
- **Skaner QR** wymaga HTTPS (GitHub Pages to zapewnia) i zgody na kamerę. Gdy kamera nie działa, zarząd może zaznaczyć obecność ręcznie albo wpisać kod.
- **Kopie zapasowe**: darmowy Supabase ich nie robi. Raz w miesiącu: *Panel zarządu → Eksport* i zapis plików na Drive komisji.
