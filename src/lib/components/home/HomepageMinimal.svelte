<script lang="ts">
  import { site } from '$lib/constants/site';
  import type { NavItem } from '$lib/constants/nav';
  import ToolsGrid from '$lib/components/global/ToolsGrid.svelte';
  import SearchFilter from '$lib/components/furniture/SearchFilter.svelte';

  interface Props {
    toolPages: NavItem[];
    referencePages: NavItem[];
  }

  let { toolPages, referencePages }: Props = $props();

  let filteredTools: NavItem[] = $state([...toolPages, ...referencePages]);
  let searchQuery: string = $state('');

  // Update filtered items when search changes
  $effect(() => {
    const allPages = [...toolPages, ...referencePages];
    if (searchQuery.trim() === '') {
      filteredTools = allPages;
    } else {
      const query = searchQuery.toLowerCase().trim();
      filteredTools = allPages.filter(
        (tool) =>
          tool.label.toLowerCase().includes(query) ||
          tool.description?.toLowerCase().includes(query) ||
          tool.keywords?.some((keyword) => keyword.toLowerCase().includes(query)),
      );
    }
  });
</script>

<!-- Minimal Hero Section -->
<section class="hero-minimal">
  <h1>{site.title}</h1>
</section>

<!-- Search Filter -->
<SearchFilter bind:filteredTools bind:searchQuery />

<!-- Compact Tools Grid -->
<ToolsGrid idPrefix="minimal" tools={filteredTools} {searchQuery} />

<style lang="scss">
  .hero-minimal {
    text-align: center;
    padding: var(--spacing-lg) 0 var(--spacing-md);

    h1 {
      font-size: var(--font-size-2xl);
      font-weight: 600;
      color: var(--text-primary);
      margin: 0;
      line-height: 1.3;

      @media (max-width: 768px) {
        font-size: var(--font-size-xl);
      }
    }
  }
</style>
