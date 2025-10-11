<script lang="ts">
  import { site } from '$lib/constants/site';
  import { TOP_NAV, SUB_NAV, type NavItem, type NavGroup } from '$lib/constants/nav';
  import ToolsGrid from '$lib/components/global/ToolsGrid.svelte';
  import SearchFilter from '$lib/components/furniture/SearchFilter.svelte';
  import { bookmarks } from '$lib/stores/bookmarks';
  import { frequentlyUsedTools, recentlyUsedTools } from '$lib/stores/toolUsage';
  import Icon from '$lib/components/global/Icon.svelte';

  interface Props {
    toolPages: NavItem[];
    referencePages: NavItem[];
  }

  let { toolPages, referencePages }: Props = $props();

  // Helper to extract nav items from mixed structure
  function extractNavItems(items: (NavItem | NavGroup)[]): NavItem[] {
    const navItems: NavItem[] = [];
    for (const item of items) {
      if ('href' in item) {
        navItems.push(item);
      } else if ('title' in item && 'items' in item) {
        navItems.push(...item.items);
      }
    }
    return navItems;
  }

  // Category configuration - easily extensible for future customization
  interface CategorySection {
    id: string;
    title: string;
    icon: string;
    basePath: string;
    items: NavItem[];
  }

  const categories: CategorySection[] = $derived(
    TOP_NAV.filter((nav) => nav.href !== '/reference')
      .map((nav) => {
        const subItems = SUB_NAV[nav.href] || [];
        return {
          id: nav.href.slice(1), // Remove leading slash
          title: nav.label,
          icon: getIconForCategory(nav.href),
          basePath: nav.href,
          items: extractNavItems(subItems),
        };
      })
      .sort((a, b) => {
        // Diagnostics first, then others
        if (a.id === 'diagnostics') return -1;
        if (b.id === 'diagnostics') return 1;
        return 0;
      }),
  );

  // Get appropriate icon for each category
  function getIconForCategory(path: string): string {
    const iconMap: Record<string, string> = {
      '/subnetting': 'network',
      '/cidr': 'layers',
      '/ip-address-convertor': 'hash',
      '/dns': 'server',
      '/diagnostics': 'activity',
    };
    return iconMap[path] || 'folder';
  }

  // Convert tool usage to NavItem format
  const mostUsedItems = $derived(
    $frequentlyUsedTools.slice(0, 8).map((tool) => ({
      href: tool.href,
      label: tool.label || 'Tool',
      icon: tool.icon,
      description: tool.description,
    })),
  );

  const recentItems = $derived(
    $recentlyUsedTools.slice(0, 4).map((tool) => ({
      href: tool.href,
      label: tool.label || 'Tool',
      icon: tool.icon,
      description: tool.description,
    })),
  );

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

<!-- Minimal Hero -->
<section class="hero-categories">
  <h1>{site.title}</h1>
</section>

<!-- Search Filter -->
<SearchFilter bind:filteredTools bind:searchQuery />

{#if searchQuery.trim() === ''}
  <div class="categories-layout">
    <!-- Bookmarks Section -->
    {#if $bookmarks.length > 0}
      <section class="category-section bookmarks-section">
        <div class="section-header">
          <Icon name="bookmarks" size="md" />
          <h2>Bookmarked</h2>
          <span class="count">{$bookmarks.length}</span>
        </div>
        <ToolsGrid
          idPrefix="bookmarked"
          tools={$bookmarks.map((b) => ({
            href: b.href,
            label: b.label,
            icon: b.icon,
            description: b.description,
          }))}
          searchQuery=""
        />
      </section>
    {/if}

    <!-- Usage Row: Most Used (2/3) and Recently Used (1/3) -->
    {#if mostUsedItems.length > 0 || recentItems.length > 0}
      {@const hasBoth = mostUsedItems.length > 0 && recentItems.length > 0}
      <div class="usage-row" class:both={hasBoth}>
        {#if mostUsedItems.length > 0}
          <section class="category-section most-used">
            <div class="section-header">
              <Icon name="frequently-used" size="md" />
              <h2>Most Used</h2>
              <span class="count">{mostUsedItems.length}</span>
            </div>
            <ToolsGrid size="compact" idPrefix="most-used" tools={mostUsedItems} searchQuery="" />
          </section>
        {/if}

        {#if recentItems.length > 0}
          <section class="category-section recently-used">
            <div class="section-header">
              <Icon name="clock" size="md" />
              <h2>Recent</h2>
              <span class="count">{recentItems.length}</span>
            </div>
            <ToolsGrid size="compact" idPrefix="recent" tools={recentItems} searchQuery="" />
          </section>
        {/if}
      </div>
    {/if}

    <!-- Category Sections -->
    <div class="categories-grid">
      {#each categories as category (category.id)}
        {#if category.items.length > 0}
          <section class="category-section" class:full-width={category.id === 'diagnostics'}>
            <div class="section-header">
              <Icon name={category.icon} size="md" />
              <h2>{category.title}</h2>
              <span class="count">{category.items.length}</span>
            </div>
            <ToolsGrid size="compact" idPrefix={category.id} tools={category.items} searchQuery="" />
          </section>
        {/if}
      {/each}

      <!-- Reference Section -->
      {#if referencePages.length > 0}
        <section class="category-section full-width">
          <div class="section-header">
            <Icon name="book-open" size="md" />
            <h2>Reference</h2>
            <span class="count">{referencePages.length}</span>
          </div>
          <ToolsGrid size="small" idPrefix="reference" tools={referencePages} searchQuery="" />
        </section>
      {/if}
    </div>
  </div>
{:else}
  <!-- Search Results -->
  <ToolsGrid idPrefix="search" tools={filteredTools} {searchQuery} />
{/if}

<style lang="scss">
  .hero-categories {
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

  .categories-layout {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xl);
  }

  .category-section {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
    background: var(--bg-tertiary);
    padding: var(--spacing-md);
    border-radius: var(--radius-md);
    border: 1px solid var(--border-primary);
    box-shadow: var(--shadow-md);
    break-inside: avoid;
    page-break-inside: avoid;
    max-height: 36rem;
    overflow-y: auto;
    animation: slideInFade 0.3s ease-out;

    // Custom scrollbar styling
    scrollbar-width: thin;
    scrollbar-color: var(--border-primary) transparent;

    &::-webkit-scrollbar {
      width: 0.5rem;
    }

    &::-webkit-scrollbar-track {
      background: transparent;
      border-radius: var(--radius-md);
    }

    &::-webkit-scrollbar-thumb {
      background: var(--border-primary);
      border-radius: var(--radius-full);
      transition: background var(--transition-fast);

      &:hover {
        background: var(--border-secondary);
      }
    }

    @media (max-width: 768px) {
      max-height: none;
      overflow-y: visible;
    }
  }

  .section-header {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding-bottom: var(--spacing-sm);
    border-bottom: 1px solid var(--border-secondary);

    h2 {
      font-size: var(--font-size-lg);
      font-weight: 600;
      color: var(--text-primary);
      margin: 0;
      flex: 1;
    }

    .count {
      font-size: var(--font-size-sm);
      color: var(--text-tertiary);
      background: var(--bg-tertiary);
      padding: var(--spacing-xs) var(--spacing-sm);
      border-radius: var(--radius-full);
      font-weight: 500;
    }

    :global(svg) {
      color: var(--color-primary);
      flex-shrink: 0;
    }
  }

  // Full width sections
  .bookmarks-section,
  .full-width {
    grid-column: 1 / -1;
  }

  // Usage row: 2/3 and 1/3 split
  .usage-row {
    display: grid;
    grid-template-columns: 1fr;
    gap: var(--spacing-lg);

    &.both {
      grid-template-columns: 2fr 1fr;
    }

    @media (max-width: 1024px) {
      grid-template-columns: 1fr;
    }
  }

  // Categories grid - flexible masonry-like layout
  .categories-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 400px), 1fr));
    gap: var(--spacing-xl);
    align-items: start;

    @media (max-width: 768px) {
      grid-template-columns: 1fr;
    }
  }

  @keyframes slideInFade {
    from {
      opacity: 0;
      transform: translateY(-8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
</style>
