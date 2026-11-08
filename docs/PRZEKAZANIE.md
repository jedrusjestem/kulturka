# Przekazanie kadencji, RODO i bezpieczeństwo

## Role przewodniczącego i administratora

- **Przewodniczący** – funkcja w komisji: pełne uprawnienia (role, ustawienia, akceptacje). Zmienia się co kadencję.
- **Administrator** – techniczny opiekun aplikacji: ma wszystko, co przewodniczący, a dodatkowo tylko on nadaje i odbiera rolę administratora. Przewodniczący nie może odebrać roli administratorowi. Musi zawsze zostać co najmniej jeden administrator.
- Rolę administratora istniejącemu kontu nadasz plikiem `supabase/nadaj-admina.sql` (Supabase → SQL Editor).
- Administrator **nie jest liczony jako członek**: nie ma go na liście członków, w listach obecności ani w statystykach.

## Prywatność profili i dane poufne

- **E-mail, telefon, nr indeksu i data urodzenia** widzi wyłącznie zarząd (zarząd, przewodniczący, administrator) oraz sam właściciel. W bazie są w osobnej tabeli `profile_private`, a e-mail w profilu nie jest dostępny dla zwykłych zapytań.
- Po pierwszym logowaniu każdy musi uzupełnić telefon i numer indeksu (ekran „Uzupełnij dane dla zarządu”).
- Każdy sam decyduje, czy inni członkowie widzą sekcje profilu: studia, „o mnie”, zainteresowania, social media (przełączniki w „Edytuj profil”). Ukryte pola widzi tylko zarząd – filtruje je baza (widok `member_profiles`), nie tylko aplikacja.

## Społeczność

- **Tablica**: posty (tekst + zdjęcie), polubienia, komentarze. **Story** znikają po 24 h (autor widzi, kto oglądał). Wygasłe story i ich zdjęcia sprząta skrypt Google.
- Moderacja: zarząd może usuwać posty, komentarze i story. Autor posta może usuwać komentarze pod swoim postem.

## Kulturkowe sprawy (zawiadomienia)

- Każdy aktywny członek może wysłać zawiadomienie (kategoria + opis) **jawnie** albo **anonimowo**. Listę spraw widzi tylko zarząd, przewodniczący i administrator.
- **Anonimowo** oznacza, że w bazie nie zapisuje się, kto zgłosił – nie da się tego odczytać nawet z poziomu Supabase. Zgłaszający dostaje prywatny kod sprawy (zapisany na jego urządzeniu), po którym widzi status i odpowiedź zarządu.
- Zarząd ustawia status (Nowa / W trakcie / Rozwiązana / Zamknięta), priorytet, osobę prowadzącą, notatkę wewnętrzną (widzi tylko zarząd) i odpowiedź dla zgłaszającego. Treści zgłoszenia nie da się edytować. Usunąć sprawę może przewodniczący/administrator.
- Zarząd dostaje e-mail o nowej sprawie (bez treści). Jawny zgłaszający dostaje e-mail o zmianie statusu i odpowiedzi.
- Sprawy nie trafiają do cotygodniowej kopii zapasowej (dane wrażliwe).

## Wydarzenia – role

| Rola w wydarzeniu | Odpowiednik | Co może |
|---|---|---|
| Koordynator główny | przewodniczący (tylko w tym wydarzeniu) | wszystko w wydarzeniu: dane, rekrutacja, sztab, kadra, ogłoszenia, spotkania, usuwanie spotkań |
| Sztab | zarząd wydarzenia | przyjmuje kadrę, publikuje bez akceptacji, akceptuje wpisy kadry, tworzy spotkania i sprawdza obecność |
| Kadra | członkowie | widzi ogłoszenia i spotkania wydarzenia, wpisy wymagają akceptacji sztabu, ankiety dostępności |

- **Własne role w wydarzeniu**: koordynator główny (lub przewodniczący) tworzy w zakładce „Role” dowolne funkcje, np. „Koordynator ds. kadry”, i wybiera ich uprawnienia: publikacja i akceptacja wpisów, rekrutacja kadry, spotkania, sprawdzanie obecności. Rolę nadaje osobom z zespołu, opcjonalnie do określonej daty.

- Wydarzenia tworzy **przewodniczący lub administrator** i wyznacza koordynatora głównego (bez akceptacji zarządu).
- Przewodniczący i administrator mają w każdym wydarzeniu pełne uprawnienia. **Zarząd komisji nie ma w wydarzeniach dodatkowych uprawnień** – jest traktowany jak członek.
- Członkowie zgłaszają się do sztabu lub kadry. Do kadry przyjmuje sztab, do sztabu – koordynator. Po przyjęciu wydarzenie pojawia się automatycznie w „Twoich wydarzeniach”.

## Role tymczasowe – uprawnienia

- **Publikuje w „Ważne”** bez akceptacji zarządu.
- **Sprawdza obecność** na wszystkich spotkaniach.
- **Tworzy i edytuje wszystkie spotkania.**
- **Edytuje swoje treści** także po akceptacji: własne ogłoszenia (pozostają opublikowane) i spotkania, które utworzył.
- **Dostęp do jednego spotkania**: na stronie spotkania zarząd w sekcji „Dostęp ról” wybiera rolę i zaznacza „Edycja” i/lub „Obecność”.

## Aktualizacja bazy po zmianach w aplikacji

Gdy w repozytorium zmieni się `supabase/schema.sql`, wklej go **w całości** w Supabase → SQL Editor i uruchom. Skrypt jest bezpieczny do ponownego uruchamiania – nie kasuje danych.

## Co roku przy zmianie zarządu (checklista)

- [ ] Nowy przewodniczący ma konto w aplikacji → stary przewodniczący nadaje mu rolę **Przewodniczący** (Panel zarządu → Członkowie i role), dopiero potem sam zmienia sobie rolę.
- [ ] Ustaw nowy zarząd (rola **Zarząd**), osoby kończące działalność → **Absolwent / były członek**.
- [ ] Usuń wygasłe role tymczasowe (wygasają same, ale lista się wydłuża).
- [ ] Przekaż hasła do **konta Google komisji**, **GitHub** i **Supabase** (wspólny menedżer haseł, np. Bitwarden – darmowy plan dla organizacji). Zmień hasła po przekazaniu.
- [ ] Pobierz **Eksport** (członkowie + frekwencja) i zapisz w folderze komisji na Drive jako archiwum kadencji.
- [ ] Sprawdź w Apps Script → *Wykonania*, że synchronizacja działa (brak czerwonych błędów).

## Dane osobowe (RODO)

Aplikacja przetwarza: imię i nazwisko, e-mail, opcjonalnie telefon/zdjęcie/opis, obecności na spotkaniach.

- Przy rejestracji użytkownik zaznacza zgodę (zapisywana data w `profiles.consent_at`).
- Każdy może w profilu **usunąć konto** – kasuje to profil, zdjęcie i obecności z bazy.
- Pliki na Google Drive (archiwalne listy obecności) na prośbę usuwa zarząd.
- Przed startem **zapytaj Samorząd/uczelnię, kto jest administratorem danych** i czy potrzebna jest klauzula informacyjna – treść zgody w formularzu można łatwo zmienić w `src/pages/Auth.jsx`.
- Telefon i e-mail są widoczne dla innych tylko, jeśli użytkownik to zaznaczy (zarząd widzi zawsze).
- W razie wycieku danych: zmień klucze w Supabase (*Project Settings → API Keys → Roll*), poinformuj Samorząd – zgłoszenie do UODO w ciągu 72 h.

## Bezpieczeństwo – jak to jest zbudowane

- **Uprawnienia są w bazie (Row Level Security)**, nie tylko w interfejsie. Nawet ktoś, kto zna klucz publiczny i API, nie zobaczy cudzych danych ani nie nada sobie roli.
- Rolę zarządu/przewodniczącego może nadać tylko przewodniczący; system nie pozwoli usunąć ostatniego przewodniczącego.
- Ogłoszenia członków trafiają do „Ważne” dopiero po akceptacji – o statusie decyduje baza.
- **Kod QR obecności zmienia się co 30 s** (HMAC z sekretem użytkownika), a weryfikuje go serwer. Zrzut ekranu wysłany koledze nie zadziała. Zgubiony telefon → *Mój kod QR → Nowy klucz QR*.
- Statyczny QR „wizytówka” w profilu tylko otwiera stronę profilu – nie liczy się jako obecność.
- Klucz `service_role` istnieje wyłącznie we właściwościach skryptu Google – nie ma go w repozytorium ani w aplikacji.
- Każda zmiana roli trafia do **Dziennika** w panelu zarządu.
