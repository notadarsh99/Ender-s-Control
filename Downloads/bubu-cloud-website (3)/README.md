# Bubu Cloud — Website

The marketing site for **Bubu Cloud**, a fast, secure and reliable hosting brand covering Minecraft, VPS, web and bot hosting.

Built with Next.js, TypeScript, Tailwind CSS and Framer Motion.

## Getting Started

```bash
npm install
npm run dev
```

The app runs at `http://localhost:3000`.

## Configuration Files

Most of the site's content is config-driven, so you can rebrand or update copy without touching component code.

| File/Directory | Purpose |
|----------------|---------|
| `/app/config/sections/` | Section content: hero, navigation, pricing, VPS, web hosting, Discord/bot hosting, games, legal, showcase, UI settings |
| `/public/lang/en.json` | English UI copy (headings, FAQ, features, etc.) — other locales live alongside it |
| `app/globals.css` | Design tokens (colors, gradients, atmosphere effects) |
| `app/layout.tsx` | Metadata, SEO, Open Graph, favicons |
| `app/components/Footer.tsx` | Footer content and logo |
| `public/meta/` | Logo, favicon and Open Graph image assets |

### Quick customization guide

1. **Colors & UI** — edit `app/globals.css` CSS variables and `app/config/sections/ui.json`
2. **Content** — edit files in `/app/config/sections/`
3. **Branding/logo** — replace files in `/public/meta/` and update references in `hero.json` / `Footer.tsx`
4. **Languages** — edit `/public/lang/*.json`
5. **SEO** — edit `app/layout.tsx`

## Production Build

```bash
npm run build
npm run start
```

### Running with PM2

```bash
npm install -g pm2
npm run build
pm2 start npm --name "bubu-cloud" -- start
```

```bash
pm2 list                    # View running processes
pm2 restart bubu-cloud      # Restart the app
pm2 stop bubu-cloud         # Stop the app
pm2 delete bubu-cloud       # Delete the app from PM2
pm2 logs bubu-cloud         # View logs
```

### Nginx Reverse Proxy

```bash
sudo nano /etc/nginx/sites-available/your-domain.com
```

```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/your-domain.com /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

For HTTPS:

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

### Deploying to Vercel

1. Push the repository to GitHub
2. Import it at [vercel.com](https://vercel.com) — Next.js is auto-detected
3. Build command `npm run build`, output directory `.next` (both auto-detected)
4. Add any environment variables under Project Settings → Environment Variables
5. Deploy — you'll get a `https://your-project-name.vercel.app` URL, with custom domain support under the Domains tab

## Tech Stack

- Next.js (App Router)
- TypeScript
- Tailwind CSS v4
- Framer Motion
- Lucide React icons
