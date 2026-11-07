# Integracja z Google (agendy w Docs, obecność w Sheets)

**Jak to działa:** baza danych aplikacji jest jedynym źródłem prawdy. Skrypt Google Apps Script, uruchomiony na **koncie Google komisji**, co 5 minut:

1. dla nowych spotkań z zaznaczonym „Utwórz agendę automatycznie” tworzy dokument Google Docs w folderze komisji (opcjonalnie z Twojego szablonu) i wstawia link do aplikacji,
2. dla każdego spotkania, w którym zmieniła się obecność, tworzy/aktualizuje arkusz „Obecność – data – tytuł” (✓/✗, sposób: QR/ręcznie, godzina),
3. odświeża zbiorczy arkusz „Frekwencja – Komisja Kultury i Projektów” (macierz osoba × spotkanie, % frekwencji),
4. przy okazji „budzi” bazę Supabase, żeby darmowy projekt nie został zapauzowany.

Dzięki temu **nikt nie musi łączyć swojego prywatnego konta Google**, nie ma weryfikacji OAuth ani wygasających tokenów, a pliki należą do komisji.

> Arkusze są „lustrem” – ręczne zmiany w nich zostaną nadpisane. Obecność zmieniaj w aplikacji (ręcznie lub skanerem).

---

## Konfiguracja (ok. 10 minut)

1. Zaloguj się na **konto Google komisji** (np. `kultura.ss@...`). Utwórz na Dysku folder, np. `Kulturka – spotkania`. Skopiuj jego link.
   - Jeśli folder jest na dysku współdzielonym / należy do kogoś innego – konto komisji musi mieć uprawnienia **Edytor**.
2. Wejdź na <https://script.google.com> → **Nowy projekt**. Nazwij go `Kulturka sync`.
3. Usuń zawartość `Kod.gs` i wklej cały plik [`google-apps-script/Code.gs`](../google-apps-script/Code.gs).
4. **Ustawienia projektu** (ikona ⚙️):
   - zaznacz *Pokaż plik manifestu „appsscript.json” w edytorze* i podmień jego treść na [`google-apps-script/appsscript.json`](../google-apps-script/appsscript.json),
   - na dole **Właściwości skryptu → Dodaj właściwość**:
     - `SUPABASE_URL` = `https://xxxx.supabase.co`
     - `SUPABASE_SERVICE_KEY` = klucz **secret/service_role** z Supabase (Project Settings → API Keys).
5. Wróć do edytora, wybierz funkcję **`setup`** z listy i kliknij **Uruchom**. Google poprosi o uprawnienia (Dysk, Dokumenty, Arkusze, połączenia zewnętrzne) – zaakceptuj na koncie komisji. Przy komunikacie „Google nie zweryfikował tej aplikacji” kliknij *Zaawansowane → Przejdź do Kulturka sync* (to Twój własny skrypt).
6. **Wdróż → Nowe wdrożenie → typ: Aplikacja internetowa**:
   - *Wykonuj jako*: **Ja** (konto komisji),
   - *Kto ma dostęp*: **Każdy**,
   - skopiuj **URL aplikacji internetowej** (`https://script.google.com/macros/s/.../exec`).
7. W Kulturce: **Panel zarządu → Google i ustawienia** wklej link do folderu i URL wdrożenia → **Zapisz**. Kliknij **Synchronizuj teraz**.

Po chwili w folderze pojawią się agendy i arkusze, a w aplikacji przy spotkaniu – linki do nich.

### Szablon agendy (opcjonalnie)

Utwórz dokument Google Docs z własnym wyglądem i znacznikami: `{{TYTUL}}`, `{{DATA}}`, `{{GODZINA}}`, `{{MIEJSCE}}`, `{{OPIS}}`. Wklej jego link w ustawieniach („Szablon agendy”). Skrypt będzie robił kopie tego dokumentu.

### Powiadomienia e-mail i kopia zapasowa

Ten sam skrypt wysyła e-maile z kolejki (z konta komisji, przez `MailApp`) i raz w tygodniu (poniedziałek ok. 3:00) zapisuje kopię bazy jako plik JSON w podfolderze **„Kopie zapasowe”** (trzyma 8 ostatnich). Kopię możesz też zrobić ręcznie: wybierz funkcję `backup` i kliknij **Uruchom**.

- Limit Google dla zwykłego konta to ok. **100 adresatów dziennie**. Gdy zabraknie limitu, reszta wyśle się następnego dnia.
- Przypomnienia przed spotkaniami włączasz w *Panel zarządu → Google i ustawienia*.
- Kopia zawiera dane osobowe członków – folder komisji udostępniaj tylko zarządowi.

> **Po aktualizacji do wersji z wydarzeniami** wklej nowy `Code.gs`, zapisz i **uruchom ponownie funkcję `setup`** (dodaje cotygodniowy wyzwalacz kopii zapasowej).

### Udostępnianie agend do edycji (opcjonalnie)

W *Panel zarządu → Google i ustawienia* można włączyć „Udostępniaj agendy do edycji”. Skrypt dodaje wtedy jako edytorów agendy:
zarząd, przewodniczącego, administratora, osoby z rolą tymczasową, której zarząd nadał na stronie spotkania dostęp „Edycja”,
oraz autora spotkania z uprawnieniem „Edytuje swoje treści”. Działa tylko dla adresów e-mail powiązanych z kontem Google –
pozostałe są pomijane (widać to w logach skryptu).

> Po aktualizacji aplikacji wklej ponownie cały `Code.gs` do edytora Apps Script i zapisz (wdrożenie aktualizuje się samo przy kolejnym uruchomieniu wyzwalacza; adres web app się nie zmienia, jeśli w *Wdróż → Zarządzaj wdrożeniami* wybierzesz edycję istniejącego wdrożenia i „Nowa wersja”).

### Zmiana folderu

Osoba uprawniona (przewodniczący) może w każdej chwili podać nowy folder w ustawieniach – nowe pliki będą trafiać tam. Stare zostają w poprzednim folderze.

### Czy publiczny URL skryptu jest bezpieczny?

Tak. Adres `?action=sync` potrafi tylko uruchomić synchronizację (maks. raz na 20 s) – nie zwraca żadnych danych i niczego nie przyjmuje. Tajny klucz Supabase jest zapisany wyłącznie we właściwościach skryptu, niewidocznych dla innych.

### Rozwiązywanie problemów

- **Executions** (Wykonania) w edytorze Apps Script pokazują logi każdego uruchomienia.
- „Ustaw SUPABASE_URL…” → brakuje właściwości skryptu (krok 4).
- „Supabase … 401” → zły klucz; użyj klucza **secret/service_role**, nie publishable.
- „Exception: No item with the given ID” → zły link do folderu lub brak uprawnień konta komisji.
