# Kulturka – Komisja Kultury i Projektów SS PWr

Aplikacja (strona + PWA na telefon) dla Komisji Kultury i Projektów Samorządu Studenckiego Politechniki Wrocławskiej. Działa w całości na darmowych usługach.

## Co potrafi

- **Konta członków** – rejestracja → akceptacja przez zarząd. Opcjonalnie tylko adresy `@student.pwr.edu.pl`.
- **Role**: członek, zarząd (akceptuje członków, ogłoszenia, sprawdza obecność), przewodniczący (pełny administrator) + **role tymczasowe** z datą wygaśnięcia i opcjonalnymi uprawnieniami (publikacja w „Ważne”, skanowanie obecności, zarządzanie spotkaniami).
- **Profile** – edycja własnej strony (zdjęcie, wydział, kierunek, opis, kontakt z ustawieniami prywatności), wyszukiwarka członków, QR „wizytówka” profilu.
- **Ważne** – ogłoszenia zarządu i (po akceptacji) członków, przypinanie, licznik nieprzeczytanych.
- **Spotkania** – kalendarz miesięczny i lista, agendy w Google Docs (link lub tworzone automatycznie), listy obecności w Google Sheets, zbiorcza frekwencja.
- **Obecność kodem QR** – każdy ma osobisty, rotujący co 30 s kod; zarząd skanuje telefonem → obecność trafia do bazy i arkusza. Działa offline (kolejka), jest ręczne zaznaczanie i wpisywanie kodu.
- **Panel zarządu** – zgłoszenia, role, ustawienia Google, eksport CSV (członkowie, frekwencja), dziennik zmian.
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
