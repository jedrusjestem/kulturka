# Kulturka – Komisja Kultury i Projektów SS PWr

Aplikacja (strona + PWA na telefon) dla Komisji Kultury i Projektów Samorządu Studenckiego Politechniki Wrocławskiej. Działa w całości na darmowych usługach.

## Co potrafi

- **Konta członków** – rejestracja → akceptacja przez zarząd. Opcjonalnie tylko adresy `@student.pwr.edu.pl`.
- **Role**: członek, zarząd (akceptuje członków, ogłoszenia, sprawdza obecność), przewodniczący (pełne uprawnienia w komisji), administrator (techniczny opiekun aplikacji – jak przewodniczący, a do tego jako jedyny nadaje rolę administratora) + **role tymczasowe** z datą wygaśnięcia i opcjonalnymi uprawnieniami (publikacja w „Ważne”, skanowanie obecności, zarządzanie spotkaniami).
- **Profile** – edycja własnej strony (zdjęcie, wydział, kierunek, opis, kontakt z ustawieniami prywatności), wyszukiwarka członków, QR „wizytówka” profilu.
- **Ważne** – ogłoszenia zarządu i (po akceptacji) członków, przypinanie, licznik nieprzeczytanych.
- **Spotkania** – kalendarz miesięczny i lista, agendy w Google Docs (link lub tworzone automatycznie), listy obecności w Google Sheets, zbiorcza frekwencja.
- **Obecność kodem QR** – każdy ma osobisty, rotujący co 30 s kod; zarząd skanuje telefonem → obecność trafia do bazy i arkusza. Działa offline (kolejka), jest ręczne zaznaczanie i wpisywanie kodu.
- **Wydarzenia** – własny zespół (koordynator główny = „przewodniczący wydarzenia”, sztab = „zarząd wydarzenia”, kadra = członkowie), rekrutacja z automatycznym dodaniem do „Twoich wydarzeń”, osobne „Ważne”, spotkania z obecnością, lista kontaktów zespołu.
- **Ankiety dostępności** (w stylu Crab Fit) w ogłoszeniach wydarzeń i w „Ważne”: zaznaczanie przeciąganiem, mapa dostępności grupy, najlepsze terminy, notatki.
- **Powiadomienia e-mail** (Apps Script): zatwierdzenie konta, przyjęcie do wydarzenia, zgłoszenia dla sztabu, ogłoszenia z opcją „wyślij e-mail”, przypomnienia dzień przed spotkaniem. Cotygodniowa **automatyczna kopia zapasowa** na Dysk.
- **Panel zarządu** – zgłoszenia, role, ustawienia Google, eksport CSV (członkowie, frekwencja, aktywność), dziennik zmian, zgłoszenia problemów od członków.
- Wersja na komputer i telefon, instalacja na ekranie głównym, bez przybliżania i w pionie.

## Struktura

```
src/                 aplikacja React (Vite)
  api/               supabaseApi.js (produkcja) + demoApi.js (tryb demo bez backendu)
  pages/             ekrany
supabase/schema.sql  baza: tabele, uprawnienia (RLS), funkcje (skan QR, usuwanie konta)
google-apps-script/  skrypt synchronizacji z Google Drive/Docs/Sheets
docs/                instrukcje: WDROZENIE.md, GOOGLE.md, PRZEKAZANIE.md
```

## Start

- Podgląd lokalny (tryb demo): `npm install`, potem `npm run dev` i otwórz <http://localhost:5173>.
- Wdrożenie: **[docs/WDROZENIE.md](docs/WDROZENIE.md)**.
- Google: **[docs/GOOGLE.md](docs/GOOGLE.md)**.
- Przekazanie kadencji, RODO, bezpieczeństwo: **[docs/PRZEKAZANIE.md](docs/PRZEKAZANIE.md)**.
