<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { site } from '$lib/constants/site';
  import Icon from '$lib/components/global/Icon.svelte';

  $: status = $page.status ?? 500;
  $: message = $page.error?.message ?? 'An unexpected error occurred';

  const errorTypes = {
    404: {
      title: 'Page Not Found',
      description: "The page you're looking for doesn't exist or has been moved.",
      icon: 'alert-circle',
      suggestions: [
        'Check the URL for typos',
        'Use the navigation menu to find what you need',
        'Return to the homepage and browse from there',
      ],
    },
    500: {
      title: 'Server Error',
      description: 'Something went wrong on our end. Please try again later.',
      icon: 'alert-triangle',
      suggestions: ['Refresh the page to try again', 'Check your internet connection', 'Try again in a few minutes'],
    },
    default: {
      title: 'Something Went Wrong',
      description: 'We encountered an unexpected error.',
      icon: 'alert-triangle',
      suggestions: ['Refresh the page to try again', 'Go back to the previous page', 'Return to the homepage'],
    },
  };

  $: errorInfo = errorTypes[status as keyof typeof errorTypes] || errorTypes.default;

  function goHome() {
    goto('/');
  }

  function refresh() {
    location.reload();
  }
</script>

<svelte:head>
  <title>{status} - {errorInfo.title} | {site.title}</title>
  <meta name="description" content={errorInfo.description} />
  <meta name="robots" content="noindex" />
</svelte:head>

<div class="error-container">
  <div class="card error-content">
    <div class="error-details">
      <h1 class="error-status">{status}</h1>
      <h2 class="error-title">{errorInfo.title}</h2>
      <p class="error-description">{errorInfo.description}</p>

      {#if message && !errorInfo.title.includes(message)}
        <details class="error-technical">
          <summary>Technical Details</summary>
          <code class="error-message">{message}</code>
        </details>
      {/if}
    </div>

    <div class="error-suggestions">
      <h3>What can you do?</h3>
      <ul>
        {#each errorInfo.suggestions as suggestion, index (index)}
          <li>{suggestion}</li>
        {/each}
      </ul>
    </div>
    <div class="error-actions">
      <button class="btn btn-primary" on:click={goHome}>
        <Icon name="arrow-left" size="sm" />
        Go Home
      </button>
      <button class="btn btn-secondary" on:click={refresh}>
        <Icon name="rotate" size="sm" />
        Refresh
      </button>
    </div>
  </div>
</div>

<style lang="scss">
  .error-container {
    min-height: 75vh;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .error-content {
    max-width: 600px;
    width: 100%;
    text-align: center;
    padding: var(--spacing-2xl);
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xl);
  }

  .error-details {
    .error-status {
      font-size: 4rem;
      font-weight: 700;
      color: var(--color-primary);
      margin: 0 0 var(--spacing-sm) 0;
      line-height: 1;
    }

    .error-title {
      font-size: var(--font-size-2xl);
      color: var(--text-primary);
      margin: 0 0 var(--spacing-md) 0;
      font-weight: 600;
    }

    .error-description {
      font-size: var(--font-size-lg);
      color: var(--text-secondary);
      margin: 0 0 var(--spacing-lg) 0;
      line-height: 1.5;
    }
  }

  .error-technical {
    text-align: left;
    margin-top: var(--spacing-md);

    summary {
      cursor: pointer;
      color: var(--text-secondary);
      font-size: var(--font-size-sm);
      margin-bottom: var(--spacing-sm);

      &:hover {
        color: var(--text-primary);
      }
    }
    .error-message {
      display: block;
      background: var(--bg-tertiary);
      padding: var(--spacing-sm);
      border-radius: var(--radius-sm);
      font-family: 'Courier New', monospace;
      font-size: var(--font-size-sm);
      color: var(--color-error);
      word-break: break-word;
      white-space: pre-wrap;
    }
  }

  .error-suggestions {
    text-align: left;

    h3 {
      color: var(--text-primary);
      margin: 0 0 var(--spacing-sm) 0;
      font-size: var(--font-size-md);
    }

    ul {
      list-style: none;
      padding: 0;
      margin: 0;

      li {
        padding: var(--spacing-2xs) 0;
        color: var(--text-secondary);
        position: relative;
        padding-left: var(--spacing-md);
        &::before {
          content: '•';
          color: var(--color-primary);
          position: absolute;
          left: 0;
        }
      }
    }
  }

  .error-actions {
    display: flex;
    gap: var(--spacing-md);
    justify-content: center;
    flex-wrap: wrap;

    .btn {
      display: flex;
      align-items: center;
      gap: var(--spacing-xs);
      padding: var(--spacing-sm) var(--spacing-md);
      border: none;
      border-radius: var(--radius-md);
      font-size: var(--font-size-sm);
      font-weight: 500;
      cursor: pointer;
      transition: all var(--transition-fast);
      text-decoration: none;

      &.btn-primary {
        background: var(--color-primary);
        color: var(--bg-primary);

        &:hover {
          background: var(--color-primary-dark);
          transform: translateY(-1px);
        }
      }

      &.btn-secondary {
        background: var(--bg-secondary);
        color: var(--text-primary);
        border: 1px solid var(--border-primary);

        &:hover {
          background: var(--surface-hover);
          border-color: var(--color-primary);
        }
      }
    }
  }

  @media (max-width: 640px) {
    .error-container {
      min-height: auto;
    }
    .error-content {
      padding: var(--spacing-xl) var(--spacing-lg);
    }
    .error-details .error-status {
      font-size: 3rem;
    }
    .error-actions {
      flex-direction: column;
      align-items: center;
      .btn {
        width: 100%;
        justify-content: center;
        max-width: 200px;
      }
    }
  }
</style>
