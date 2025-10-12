import { writable } from 'svelte/store';
import { browser } from '$app/environment';
import { cacheBookmark, cacheAllBookmarks } from './offline';

export interface BookmarkedTool {
  href: string;
  label: string;
  description: string;
  icon: string;
}

const STORAGE_KEY = 'bookmarked-tools';

// Get initial bookmarks from localStorage (runs immediately on import)
function getInitialBookmarks(): BookmarkedTool[] {
  if (browser) {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      return [];
    }
  }
  return [];
}

function createBookmarksStore() {
  const { subscribe, set, update } = writable<BookmarkedTool[]>(getInitialBookmarks());
  let cachingInitialized = false; // Prevent multiple cache requests

  return {
    subscribe,
    init: () => {
      if (browser) {
        const bookmarks = getInitialBookmarks();
        set(bookmarks);
        // Cache all existing bookmarks for offline access (only once per session)
        if (bookmarks.length > 0 && !cachingInitialized) {
          cachingInitialized = true;
          setTimeout(() => cacheAllBookmarks(bookmarks), 1000); // Delay to ensure SW is ready
        }
      }
    },
    add: (tool: BookmarkedTool) => {
      update((bookmarks) => {
        if (!bookmarks.find((b) => b.href === tool.href)) {
          const newBookmarks = [...bookmarks, tool];
          if (browser) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(newBookmarks));
            // Cache the bookmarked tool for offline access
            cacheBookmark(tool.href);
          }
          return newBookmarks;
        }
        return bookmarks;
      });
    },
    remove: (href: string) => {
      update((bookmarks) => {
        const newBookmarks = bookmarks.filter((b) => b.href !== href);
        if (browser) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(newBookmarks));
        }
        return newBookmarks;
      });
    },
    toggle: (tool: BookmarkedTool) => {
      update((bookmarks) => {
        const existing = bookmarks.find((b) => b.href === tool.href);
        const newBookmarks = existing ? bookmarks.filter((b) => b.href !== tool.href) : [...bookmarks, tool];
        if (browser) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(newBookmarks));
          // Cache the bookmarked tool for offline access when adding
          if (!existing) {
            cacheBookmark(tool.href);
          }
        }
        return newBookmarks;
      });
    },
    isBookmarked: (href: string, bookmarks: BookmarkedTool[]) => {
      return bookmarks.some((b) => b.href === href);
    },
  };
}

export const bookmarks = createBookmarksStore();
