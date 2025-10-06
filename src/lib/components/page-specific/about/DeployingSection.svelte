<script>
  import '../../../../styles/page-specific/about-page.scss';
</script>

<section id="deploying">
  <h2>Deploying</h2>
  <p>
    As well as our free hosted version, at <a href="https://networkingtoolbox.net">networkingtoolbox.net</a>, we've made
    it as quick and easy as possible for you to deploy your own instance. Either on your own infrastructure, or using
    one of our supported free hosting providers.
  </p>

  <h3>Option #1 - Docker</h3>
  <p>With Docker installed, just run the following command:</p>
  <div class="code">
    <code>docker run -p 8080:8080 lissy93/networking-toolbox</code>
  </div>
  <p>
    You can also checkout our <a href="https://github.com/Lissy93/networking-toolbox/blob/main/docker-compose.yml"
      ><code>docker-compose.yml</code></a
    >, using the
    <a href="https://hub.docker.com/r/lissy93/networking-toolbox"><code>lissy93/networking-toolbox</code></a> image from
    DockerHub.
  </p>

  <h3>Option #2 - Free Hosting Provider</h3>
  <p>
    You can quickly and easily deploy your own instance for free, on any other our supported hosting providers! Just
    fork our repository, and then import it into your chosen provider.
  </p>

  <p>Alternatively, just click one of the buttons below!</p>

  <h3>Option #3 - GitHub Pages</h3>
  <ol>
    <li>Fork the repository (you'll need a free GitHub account)</li>
    <li>Go to your new repo's Settings → Pages → Source and select the <code>gh-pages</code> branch</li>
    <li>Then, head to the Actions tab, find the "Deploy to GitHub Pages" workflow, and trigger it</li>
    <li>Visit <code>https://[your-username].github.io/networking-toolbox/</code> to see your deployed app</li>
  </ol>

  <h3>Option #4 - Source</h3>
  <p>
    If you want to make any changes before deploying, or want to host it on any other platform not already covered
    above, then you can easily do so, by compiling the app from source. We've dot detailed <a href="/about/building"
      >Building Instructions</a
    >, or you can check out the docs in the repo.
  </p>
</section>

<style>
  ol {
    padding-left: 2rem;
  }
  h3 {
    margin-top: var(--spacing-lg);
  }
</style>
