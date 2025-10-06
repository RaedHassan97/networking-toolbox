<script lang="ts">
  import { ALL_PAGES } from '$lib/constants/nav';
  import ToolCard from './ToolCard.svelte';
  import NoResults from './NoResults.svelte';
  import type { NavItem } from '$lib/constants/nav';

  export let tools: NavItem[] = ALL_PAGES;
  export let searchQuery: string = '';
  export let idPrefix: string = 'main-';

  // Remove duplicates based on href, keeping the first occurrence
  // Also filter out items without a label
  $: uniqueTools = tools
    .filter((tool) => tool.label)
    .filter((tool, index, array) => array.findIndex((t) => t.href === tool.href) === index);
</script>

{#if uniqueTools.length === 0 && searchQuery}
  <NoResults {searchQuery} />
{:else}
  <section class="tools-grid">
    {#each uniqueTools as tool (`${idPrefix}-${tool.href.replaceAll('/', '-')}`)}
      <ToolCard {tool} />
    {/each}
  </section>
{/if}

<style lang="scss">
  .tools-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: var(--spacing-md);
    margin-bottom: var(--spacing-xl);

    @media (max-width: 768px) {
      grid-template-columns: 1fr;
      gap: var(--spacing-md);
    }

    @media (min-width: 1200px) {
      grid-template-columns: repeat(3, 1fr);
    }
  }
</style>
