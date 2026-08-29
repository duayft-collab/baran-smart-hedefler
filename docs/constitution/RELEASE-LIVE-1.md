# RELEASE-LIVE-1 — FocusUp Gerçek Sürüm Kapısı

Bu belge **bu depoda gerçekten var olan** kapıları tanımlar.

CLAUDE.md; Typecheck, ESLint, Vitest, `npm build` ve "Constitution" adımlarından söz
eder. **Bu depoda bunların hiçbiri yoktur** — `package.json`, `node_modules`,
TypeScript, ESLint yapılandırması ve Vitest bulunmamaktadır. Proje; derleme adımı
olmayan, tarayıcıya doğrudan `<script>` etiketleriyle yüklenen düz ES5 JavaScript
dosyalarından oluşur ve Firebase Hosting ile yayınlanır.

Bu belge o boşluğu **gerçeği yazarak** kapatır. Var olmayan bir araç eklenmemiştir.

Doğrulandığı sürüm: `8b9245c` · Oluşturulma: Faz 1 (Koçluk Domain Temeli)

---

## G0 — Depo Durumu (her işten önce)

```bash
pwd && git branch --show-current && git rev-parse HEAD
git rev-parse origin/main
git rev-list --left-right --count origin/main...HEAD    # 0  0 beklenir
git status --porcelain=v1 -uall                          # boş beklenir
git worktree list && git stash list
```

Başka bir iş akışına ait dosya **reset/stash/clean/overwrite edilmez**.

---

## G1 — JavaScript Sözdizimi Doğrulaması

Derleyici yok; tek gerçek statik doğrulama Node'un parser'ıdır.

```bash
for f in js/*.js public/js/*.js; do node --check "$f" || echo "FAIL $f"; done
```

**Geçme ölçütü:** hiçbir `FAIL` satırı yok.

---

## G2 — Tam Test Paketi

Test altyapısı: **Node yerleşik test koşucusu** (`node:test` + `node:assert/strict`).
Testler gerçek üretim dosyalarını `tests/harness.js` içindeki `vm` sandbox'a yükler —
yani mantık yeniden yazılmaz, gerçek kod çalıştırılır.

```bash
node --test 'tests/*.test.js'
```

> Not: `node --test tests/` çalışmaz (dizin biçimi desteklenmiyor). Glob zorunludur.

**Geçme ölçütü:** `fail 0`, `cancelled 0`.
**Bilinen taban:** `8b9245c` → **1464 test / 390 suite PASS**.
Her iş, tabanı **düşürmeden** kendi testlerini eklemelidir.

Tek dosya çalıştırma (geliştirme sırasında):

```bash
node --test tests/<ad>.test.js
```

---

## G3 — `js/` ↔ `public/js/` Ayna Bütünlüğü

`public/` yayınlanan dizindir (`firebase.json` → `"public": "public"`) ve
`js/`, `css/`, `index.html` dosyalarının **byte-birebir** aynasıdır. Ayna bozulursa
canlı, testlerin doğruladığından farklı kod çalıştırır.

```bash
diff -rq js public/js && diff -rq css public/css && diff index.html public/index.html && echo MIRROR-OK
```

**Geçme ölçütü:** `MIRROR-OK`.

Ayrıca her modülün kendi test dosyası, kendi aynasını iddia eder
(`mirror byte-identity js ↔ public/js`). Yeni modül eklenirken bu testin de
eklenmesi zorunludur.

---

## G4 — Modül Boyutu

CLAUDE.md kuralı: bir dosya **900 satırı geçmez**.

```bash
wc -l js/*.js | awk '$2!="total" && $1>=900 {print "OVER:", $2, $1}'
```

**Geçme ölçütü:** yeni bir `OVER` satırı yok.

**Bilinen ve dondurulmuş istisna:** `js/09-goals.js` = **1141 satır** (Faz 0'da tespit
edilen mevcut teknik borç). Bu dosya **büyütülemez**; yeni özellik kodu asla buraya
eklenmez, ayrı modül dosyası açılır. Borç ayrı bir refactor işinde kapatılacaktır.

---

## G5 — Statik Mimari Muhafızları

Bu depo, mimari kararları **kaynak metni üzerinde regex iddialarıyla** korur
(örn. `tests/wisdom-coach-p6.test.js` → "no forbidden write/network/collection
tokens"). Bir modül "salt-okunur", "0 yazma", "ağ yok" veya "AI yok" diye
belgelendiyse, bunu **doğrulayan bir test yazmak zorunludur**.

Depo genelinde geçerli, ihlal edilmemesi gereken değişmezler:

| Değişmez | Doğrulama |
|---|---|
| Harici AI/LLM sağlayıcısı yok | `grep -rn "openai\|anthropic\|gemini\|api_key\|apiKey" js/` → 0 |
| Beklenmedik ağ ucu yok | `grep -rn "XMLHttpRequest\|WebSocket\|EventSource" js/` → 0 |
| `fetch` yalnız tek, bilinen yerde | `grep -rn "fetch(" js/` → **tam 1** — `js/03-auth.js` içindeki aynı-kaynak `/__/firebase/init.json` Hosting yapılandırması |
| İzinli dış kaynaklar | Firebase SDK, Google Fonts, `cdn.pixabay.com` (odak sesleri) |
| Tek doğruluk kaynağı | Aynı veri hem `D` içinde hem ayrı koleksiyonda tutulmaz |

```bash
grep -rn "openai\|anthropic\|gemini\|api_key\|apiKey\|XMLHttpRequest\|WebSocket\|EventSource" js/ ; echo "exit=$?  (1 = temiz)"
grep -rnc "fetch(" js/03-auth.js          # 1 beklenir
grep -rn  "fetch(" js/ | grep -v "03-auth.js" ; echo "exit=$?  (1 = temiz)"
```

---

## G6 — Firestore Rules Muhafızları

Depoda **Firebase emülatörü veya rules-unit-testing bağımlılığı yoktur** (npm yok).
Bu nedenle `firestore.rules` iki katmanda korunur:

1. **Statik iddia (otomatik):** rules dosyasının içermesi gereken cümleler test
   edilir — sahip-eşitliği kuralı, fail-closed yardımcılar, modül-kapsamlı
   yetenek denetimi, `allow read, write: if false` benzeri geniş açıklıkların
   yokluğu. Örnek: `tests/wisdom-sharding-p2.test.js`, `tests/coaching-domain-p1.test.js`.
2. **Saf-JS referans uygulaması (otomatik):** rules'taki yetkilendirme kararının
   aynısı istemci tarafında `personalCan()` / `coachingCan()` ile ifade edilir ve
   davranışsal olarak test edilir (sahip izinli · yabancı reddedilir · genel
   `state.read` okuyucusu erişim kazanamaz · çapraz-sahip reddedilir).
3. **Manuel doğrulama (deploy anında, zorunlu):** rules yalnız ayrı onayla ve
   `firebase deploy --only firestore:rules` ile yayınlanır; ardından canlıda
   en az bir izinli ve bir reddedilmesi gereken erişim elle denenir.

**Kural:** Rules dosyası değiştiyse iş, canlı doğrulama yapılmadan
"tamamlandı" sayılmaz.

---

## G7 — Üretim Duman Testi (canlı davranış değiştiğinde)

Aşağıdakilerden **herhangi biri** değiştiyse zorunludur: `index.html`, bir
`<script>` sürüm parametresi, bir render/rota/menü yolu, `firestore.rules`,
senkron/yedek/geri-yükleme yolu.

1. Sert yenileme (cache-bust parametresinin arttığı doğrulanır).
2. Konsolda hata **yok**.
3. Bulut rozeti `Google hesabında kayıtlı` durumuna ulaşıyor.
4. Değişen ekran **gerçek tıklamayla** açılıyor; boş/bozuk düzen yok.
5. Değişmemesi gereken ekranlar (Hedefler · Bugün · Özlü Sözler) hâlâ çalışıyor.
6. Mobil genişlikte menü/scrim çalışıyor.
7. Bir kayıt oluştur → yenile → kalıcı olduğu doğrulanır.
8. Çoklu hesap kullanılıyorsa: çıkış → başka hesapla giriş → veri sızıntısı yok.

**Salt-temel (foundation-only) işler:** kullanıcıya görünen hiçbir davranış
değişmiyorsa G7 uygulanmaz; bunun yerine "OFF iken byte-identical" testi zorunludur.

---

## G8 — Commit Sınırı

```
Full Gate yeşil  →  COMMIT READY
```

Commit, push ve deploy **ayrı ayrı onay ister** (CLAUDE.md). Force push, reset,
rebase, amend yasaktır.

---

## Kapı Özeti

| # | Kapı | Komut / Yöntem | Otomatik |
|---|---|---|---|
| G0 | Depo durumu | `git status` / `worktree` / `stash` | hayır |
| G1 | Sözdizimi | `node --check js/*.js public/js/*.js` | evet |
| G2 | Tam test | `node --test 'tests/*.test.js'` | evet |
| G3 | Ayna | `diff -rq js public/js` (+css, +index.html) | evet |
| G4 | Modül boyutu | `wc -l js/*.js` < 900 | evet |
| G5 | Mimari muhafız | test içi regex iddiaları | evet |
| G6 | Rules | statik iddia + referans uygulama + manuel deploy testi | kısmi |
| G7 | Canlı duman | elle checklist | hayır |
| G8 | Commit sınırı | ayrı onay | hayır |

**Çıkış kriteri:** G1-G5 tam yeşil · G6 uygulanabilir olduğu ölçüde yeşil ·
G7 canlı davranış değiştiyse tamamlanmış · ancak o zaman COMMIT READY.
