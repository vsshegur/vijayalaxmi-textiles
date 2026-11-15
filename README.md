# Vijayalaxmi Textiles website

A fast, Google-friendly showcase site for Vijayalaxmi Textiles, Solapur, with an admin panel at `/admin` for adding and removing products.

- No database. Products, sizes, ratings and business details live in `data/*.json` in this repository.
- The admin panel saves changes straight into this repository. Cloudflare Pages then rebuilds the site automatically (about 1–2 minutes).
- Every product and towel type gets its own page, with structured data for Google, a sitemap and robots.txt.

## One-time setup (all in the browser)

### 1. Put the code on GitHub
Create a new repository (for example `vijayalaxmi-textiles`) and upload these files, or let Claude push them for you.

### 2. Create the site on Cloudflare Pages
Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git** → pick the repository.

| Setting | Value |
|---|---|
| Framework preset | None |
| Build command | `node build.mjs` |
| Build output directory | `dist` |
| Root directory | *(leave empty)* |

### 3. Create a GitHub token for the admin panel
GitHub → Settings → Developer settings → **Fine-grained personal access tokens** → **Generate new token**
- Repository access: **Only select repositories** → this repository
- Permissions → Repository permissions → **Contents: Read and write**
- Copy the token.

### 4. Add the admin password and token in Cloudflare
Cloudflare Pages project → **Settings** → **Variables and Secrets** → add these for **Production** (use type *Secret* for the password and token):

| Name | Value |
|---|---|
| `ADMIN_USER` | your admin username, e.g. `admin` |
| `ADMIN_PASSWORD` | a strong password |
| `GITHUB_TOKEN` | the token from step 3 |
| `GITHUB_REPO` | `your-github-name/vijayalaxmi-textiles` |
| `GITHUB_BRANCH` | `main` (only if your branch has another name) |

Then **Deployments** → **Retry deployment** (or push any change) so the settings take effect.

### 5. Connect your domain
Pages project → **Custom domains** → add your domain. Then open `/admin` → **Business details** → set **Website address** to the same domain (for example `https://vijayalaxmitextiles.com`) and publish. Google uses this address for every page.

### 6. Tell Google about the site
1. Open Google Search Console, add your domain and verify it.
2. Submit `https://YOUR-DOMAIN/sitemap.xml` under **Sitemaps**.
3. In your Google Business Profile, set the website to your domain.
4. Add the website link to your IndiaMART and Justdial profiles too. Links between your profiles and your site help Google treat them as one brand.

## Using the admin panel
Open `https://YOUR-DOMAIN/admin`, sign in with `ADMIN_USER` / `ADMIN_PASSWORD`.

- **Products**: add, edit, hide or delete towels. Tick each size the towel is made in (with weight per size), choose material and pattern, add photos. Choosing **Microfiber** asks for the country of origin (China, India or another); all other materials are set to India.
- **Towel types & sizes**: rename types, add sizes (written like `30x60`), add new types such as Kitchen Towels.
- **Ratings**: update your IndiaMART, Google and Justdial rating, review count and profile link.
- **Business details**: phone, WhatsApp, address, GSTIN, About text, and the lists used in the product form.
- **Homepage design**: switch between the Loom, Showroom and Heritage layouts.

Nothing changes on the live site until you press **Publish changes**. Unpublished edits are kept on your device if you close the tab.

## Project layout

```
build.mjs            builds the site into dist/ (no packages needed)
src/templates.mjs    page templates
src/site.css         site styles
src/site.js          size picker, filters, enquiry form
data/                settings, towel types and products (edited by the admin panel)
static/              favicon, logo, share image, product photos, Cloudflare _headers/_routes
admin/               the admin panel
functions/           Cloudflare Pages Functions: login check, read data, publish to GitHub
lib/github.js        GitHub helper used by the functions
```
