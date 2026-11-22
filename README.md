# BarterApp
je aplikacija za blagovno menjavo med posamezniki. Uporabnik objavi izdelek ki ga ne potrebuje več, ter odda prošnjo za menjavo drugemu uporabniku. Po tem lahko uporabnik sprejme ali zavrne ponudbo, za lažji dogovor pa lahko tudi klepetata.
Aplikacija se namešča na VM na 2 načina; z Vagrantom (vagrant/) ali cloud-init (cloud-init/). 
## Funkcionalnosti:
 - Registracija, prijava in odjava uporabnikov
 - objava izdelkov z opisom, kategorijo in fotografijo
 - pregledovanje in iskanje izdelkov po katergoriji in besedilu
 - pošiljanje predlogov za menjavo
 - pregled prejetih in poslanih predlogo, sprejem ali zavrnitev
 - sporočila med udeleženci
 - profil kjer lahko vidimo svoje izdelke in zgodovino menjav

## Backend (app/backend)
Uporabljamo REST API v Node.js + TypeScript z ogrodjem express 5.
Za podatkovno bazo smo uporabili bazo postgresql, Redis 7 za hrambo žetonov prijavljenih uporabnikov, knjižici bycript ter multer pa za haširanje gesel nalaganje slik.

Lokalni zagon za razvoj
1. v postgreSQL ustvari uporabnika in bazo `barter` in naredi shemo:
    ```powershell
    psql -U postgres -c "CREATE ROLE barter LOGIN PASSWORD '<geslo>'"
    psql -U postgres -c "CREATE DATABASE barter OWNER barter"
    psql -h 127.0.0.1 -U barter -d barter -f app/backend/db/schema.sql
    ```
2. v app/backend ustvari datoteko .env
3. Zaženi backend
    ```bash
    cd app/backend
    npm install
    npm run dev
    ```

API posluša na http://127.0.0.1:3000. Preverjanje: `GET /health` pa preveri ali sta baza in Redis dosegljiva.

### Konfiguracija
Primer datoteke `.env`˛:
```
PORT=3000
DATABASE_URL=postgres://barter:<geslo>@127.0.0.1:5432/barter
REDIS_URL=redis://:<geslo>@127.0.0.1:6379
SESSION_TTL_SECONDS=86400
UPLOAD_DIR=uploads
```
PORT - API port
DATABASE_URL - povezava do PostgreSQL
REDIS_URL - Povezava do Redisa
SESSION_TTL_SECONDS - trajanje seje 
UPLOAD_DIR

### NPM skripte
`npm run dev` - razvoj s samodejnim ponovnim nalaganjem, prebere .env

`npm run build` - prevede TypeScript v dist/

`npm start` - zažene prevedeno različico

### Struktura src/
`index.ts` - ustvari Express aplikacijo, priklopi routerje, /health, /me, error handler, zagon strežnika

`db.ts` - PostgreSQL connection pool in isId za preverjanje id-jev

`redis.ts` - Redis odjemalec

`auth.ts` - registracija, prijava, odjava in middleware requireauth

`items.ts` - izdelki; seznami s filtri, podrobnosti, objava s sliko

`offers.ts` - ponudbe za menjavo: ustvarjanje, seznam, sprejem/zavrnitev

`messages.ts` - sporočila znotraj ponudbe

### Avtentikacija
Ob prijavi na strežnik se ustvari naključen 32 bajtni žeton in se shrani v Redis kot id uporabnika s potekom SESSION_TLL_SECONDS. Odjemalec žeton pošlje v glavi
`Authorization : Bearer <token>`

Odjava žeton izbriše iz Redisa. Vse poti razen /health, /auth/register, /auth/login in /uploads zahtevajo veljaven žeton.

### API
na VM-ju so vse poti dosegljive s predpono /api katero nginx odstrani.
| Metoda | Pot | Opis |
|---|---|---|
| `GET` | `/health` | stanje baze in Redisa |
| `POST` | `/auth/register` | { email, password, displayName }, geslo vsaj 8 znakov |
| `POST` | `/auth/login` | { email, password } → { token } |
| `POST` | `/auth/logout` | izbriše trenutno sejo |
| `GET` | `/me` | podatki prijavljenega uporabnika |
| `GET` | `/items?category=&q=` | razpoložljivi izdelki, filter po kategoriji in iskanje po naslovu/opisu |
| `GET` | `/items/mine` | vsi izdelki prijavljenega uporabnika (tudi zamenjani) |
| `GET` | `/items/:id` | podrobnosti izdelka |
| `POST` | `/items` | multipart/form-data: title, description, category, neobvezno image (JPEG/PNG/WEBP, do 5 MB) |
| `DELETE` | `/items/:id` | samo lastnik in samo, če izdelek še ni zamenjan |
| `POST` | `/offers` | ponudi svoj izdelek za tujega |
| `GET` | `/offers?box=received\|sent` | prejete ali poslane ponudbe |
| `PATCH` | `/offers/:id` | samo lastnik zahtevanega izdelka |
| `GET` | `/offers/:id/messages?after=<id>` | sporočila ponudbe, z after samo novejša (za polling) |
| `POST` | `/offers/:id/messages` | { body }, 1–1000 znakov; ni mogoče pri zavrnjeni ponudbi |

### Baza
Shema je idempotentna (CREATE ... IF NOT EXISTS), da jo lahko poženemo večkrat brez izgube podatkov.
Imamo tabele users, items, offers in messages.
Preverjamo kategorije in statuse s CHECK, da menjan izdelek ni enak, da je za en par izdelkov lahko samo 1 ponudba ter da se ob brisanju izbrišejo tudi njegove ponudbe in sporočila.

### Vagrant (vagrant/)
Postavi celo aplikacijo v en VM (base image je Ubuntu 24.04 kateremu nastavimo 2 cpu in 2GB rama)
```bash
cd vagrant          
vagrant up          # ustvari in provisiona VM
vagrant provision   # ponovno izvede provisioning
vagrant ssh         # Prijava v VM
vagrant destroy     # izbriše VM
```

Aplikacija ima API dosegljiv na `https://localhost:8443` s samopodpisanim certifikatom ter `https://localhost:8080`
Celoten projekt je v VM na voljo v /repo (synced folder).

`01-base.sh`	    posodobi pakete, namesti curl in ca-certificates

`02-postgres.sh`	namesti PostgreSQL, ustvari uporabnika in bazo barter z naključnim geslom, izvede schema.sql

`03-redis.sh`	    namesti Redis in ga zaščiti z naključnim geslom (requirepass)

`04-app.sh`	        namesti Node.js 22, prekopira backend v /opt/barterapp/backend, ga zgradi in zažene kot systemd servis barterapp

`05-nginx.sh`	    namesti nginx, ustvari samopodpisan TLS certifikat in nastavi reverse proxy

### Skrivnosti in konfiguracija
/etc/barterapp/secrets.env  - gesli za Postgres in Redis
/etc/barterapp/backend.env  - okoljske spremenljivke za API
/ops/barterapp/backend      - prevedena koda APIja
/var/lib/barterapp/uploads  - naložene slike


### Service API-ja
API teče kot systemd service pod sistemskim uporanikom barterapp (brez prijave), z NoNewPrivileges in PrivateTmp. Ob napaki se ponovno sam zažene.

#### nginx
/ - statične datoteke frontenda,
/uploads/ - slike neposredno z diska
/api/auth - API z omejitvijo 5 zahtevkov/min na IP
/api/ - API na 127.0.0.1:3000 (predpono /api/ nginx odreže)

Največja velikost zahtevka je lahko 6MB.