# Customization Guide

If you're self-hosting Networking Toolbox, you can customize the branding for your instance with a few env vars.

## Overview

Networking Toolbox supports customization through environment variables. This allows you to:
- Brand the application with your organization's name
- Use a custom logo/icon
- Set default themes and layouts
- Maintain consistency across your organization

**Important:** These customizations only affect the default values. Users can still customize their personal preferences through the settings menu, and those will be stored in their browser's localStorage.

## Getting Started

Download the [`.env.example`](https://gist.githubusercontent.com/Lissy93/3c5f85dc0e2263a4706d3e136f0a076e/raw/62a00f625c920ac9e1cafe60721213e2ea233581/.env.example) to `.env` in the root of your project.

1. Copy `.env.example` to `.env`:
   ```bash
    curl -o .env https://gist.githubusercontent.com/Lissy93/3c5f85dc0e2263a4706d3e136f0a076e/raw/62a00f625c920ac9e1cafe60721213e2ea233581/.env.example
   ```

2. Edit `.env` and uncomment/modify the variables you want to customize

3. Restart your application to apply changes

## Available Customizations

### Site Branding

```bash
# Customize your site name and description
NTB_SITE_NAME=My Network Tools
NTB_SITE_TITLE=My Network Tools
NTB_SITE_DESCRIPTION=Professional networking utilities for your team
```

### Custom Logo

Use a custom logo image in the navbar:

```bash
NTB_SITE_ICON=/logo.svg
```

Place your logo image in the `static/` directory and reference it with a leading slash. Supported formats: SVG, PNG, JPG, WebP.

### Default Layout

Set the default homepage layout:

```bash
# Options: categories, default, minimal, carousel, bookmarks, small-icons, list, search, empty
NTB_HOMEPAGE_LAYOUT=categories
```

### Default Navbar Display

Control what appears in the top navigation:

```bash
# Options: default, bookmarked, frequent, none
NTB_NAVBAR_DISPLAY=default
```

### Default Theme

Set the default color theme:

```bash
# Options: dark, light, midnight, arctic, ocean, purple, cyberpunk, terminal, lightpurple, muteddark, solarized
NTB_DEFAULT_THEME=dark
```

## Example Configurations

### Corporate Branding Example

```bash
NTB_SITE_NAME=Acme Corp Network Tools
NTB_SITE_TITLE=Acme Corp Network Tools
NTB_SITE_DESCRIPTION=Internal networking utilities for Acme Corp IT team
NTB_SITE_ICON=/acme-logo.svg
NTB_DEFAULT_THEME=light
NTB_HOMEPAGE_LAYOUT=list
```

### Minimalist Setup Example

```bash
NTB_SITE_NAME=NetUtils
NTB_SITE_DESCRIPTION=Simple network utilities
NTB_DEFAULT_THEME=muteddark
NTB_HOMEPAGE_LAYOUT=search
NTB_NAVBAR_DISPLAY=none
```

## Docker Deployment

When using Docker, pass environment variables with the `-e` flag or use a `.env` file:

```bash
docker run -p 5000:5000 \
  -e NTB_SITE_NAME="My Network Tools" \
  -e NTB_DEFAULT_THEME="light" \
  lissy93/networking-toolbox
```

Or with docker-compose:

```yaml
services:
  networking-toolbox:
    image: lissy93/networking-toolbox
    ports:
      - "5000:5000"
    environment:
      - NTB_SITE_NAME=My Network Tools
      - NTB_DEFAULT_THEME=light
      - NTB_SITE_ICON=/custom-logo.svg
    volumes:
      - ./static:/app/static  # For custom logo
```

## Notes

- All environment variables must be prefixed with `NTB_` to be accessible
- Changes require an application restart to take effect
- The managed instance at [networking-toolbox.as93.net](https://networking-toolbox.as93.net) uses the default values
- User preferences set through the UI take precedence over these defaults
- Invalid values will fallback to the default settings


