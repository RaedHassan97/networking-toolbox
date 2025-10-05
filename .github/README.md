
<h1 align="center">Networking Toolbox</h1>
<p align="center">
  <i>The all-in-one offline-first networking toolbox for sysadmins</i><br>
  🌐 <b><a href="https://networking-toolbox.as93.net">networking-toolbox.as93.net</a></b>
</p>
<a href="https://networking-toolbox.as93.net">
<p align="center">
  <img width="128" src="https://github.com/Lissy93/networking-toolbox/blob/main/static/icon.png?raw=true" />
  </p>
</a>

---

### Deploying

#### Option 1 - Docker
Run `docker run -p 8080:80 lissy93/networking-toolbox`<br>
Or, use our example [`docker-compose.yml`](https://github.com/Lissy93/networking-toolbox/blob/main/docker-compose.yml)

#### Option 2 - Cloud
Fork the repo, and import into Vercel, Netlify or any static hosting provider of your choice.

#### Option 3 - Source: Node
Follow the dev steps below.
Then run `npm run build:node` to compile output.<br>
You can then start the server with `node build`.

<details>
<summary>More Deployment Options</summary>

#### Option 4 - Source: Static
Follow the dev steps below.
Then run `npm run build:static` to compile output.<br>
And upload the contents of `./build` to any web server, CDN or static host.

#### Option 5 - Source: Docker
Follow the dev steps below.
Then run `docker build -t networking-toolbox .` to build the image.<br>
You can then start the container with `docker run -p 8080:80 networking-toolbox`.

#### Option 6 - GitHub Pages
Fork the repo.<br>
Head to the Actions tab, find the "Deploy to GitHub Pages" workflow, and trigger it.<br>
Then go to Settings > Pages > Source and select the `gh-pages` branch.<br>
Visit `https://<your-username>.github.io/networking-toolbox/` to see your deployed app.
</details>

---

### Developing

#### Prerequisites
You'll need Node.js installed, as well as Git and optionally Docker.<br>
The app is build with Svelte + SvelteKit in TypeScript.

#### Setup Commands

```
git clone git@github.com:Lissy93/networking-toolbox.git
cd networking-toolbox
yarn
yarn dev
```

#### Testing

Before merging, code must pass all unit and end-to-end tests, as well as linting, type checks, svelte check and build checks.<br>

```
yarn test
```

---

### Contributing
Contributions are welcome (and much appreciated!)<br>
Follow the dev instructions above to get started, then check the [Contributing Guidelines](), and submit your changes as a PR.<br>
If you're new to GitHub or open source, take a look at [git-in.to](https://git-in.to) for a guide on getting started.

---

### Features
100+ networking and sysadmin tools, zero third-party dependencies, works ofline.

<p align="center">
   <img width="2761" height="1229" alt="networking-toolbox" src="https://github.com/user-attachments/assets/2a128ee2-9bcb-49f0-be41-f69a3b8f2474" />
  <br>
  <sup><i>We've got 100+ tools, covering all aspects of network engineering</i></sup>
</p>

---

<!-- License + Copyright -->
<p  align="center">
  <i>© <a href="https://aliciasykes.com">Alicia Sykes</a> 2025</i><br>
  <i>Licensed under <a href="https://gist.github.com/Lissy93/143d2ee01ccc5c052a17">MIT</a></i><br>
  <a href="https://github.com/lissy93"><img src="https://i.ibb.co/4KtpYxb/octocat-clean-mini.png" /></a><br>
  <sup>Thanks for visiting :)</sup>
</p>

<!-- Dinosaur -->
<!-- 
                        . - ~ ~ ~ - .
      ..     _      .-~               ~-.
     //|     \ `..~                      `.
    || |      }  }              /       \  \
(\   \\ \~^..'                 |         }  \
 \`.-~  o      /       }       |        /    \
 (__          |       /        |       /      `.
  `- - ~ ~ -._|      /_ - ~ ~ ^|      /- _      `.
              |     /          |     /     ~-.     ~- _
              |_____|          |_____|         ~ - . _ _~_-_
-->
