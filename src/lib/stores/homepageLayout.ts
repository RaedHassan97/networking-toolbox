import { writable } from 'svelte/store';
import { browser } from '$app/environment';

export type HomepageLayoutMode = 'default' | 'minimal' | 'categories';

export interface HomepageLayoutOption {
  id: HomepageLayoutMode;
  name: string;
  description: string;
}

const STORAGE_KEY = 'homepage-layout';

// Available homepage layout options
export const homepageLayoutOptions: HomepageLayoutOption[] = [
  {
    id: 'default',
    name: 'Default',
    description: 'Full homepage with all sections and features',
  },
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Clean, simplified homepage layout',
  },
  {
    id: 'categories',
    name: 'Categories',
    description: 'Organized by tool categories with flexible grid layout',
  },
];

function createHomepageLayoutStore() {
  const { subscribe, set } = writable<HomepageLayoutMode>('categories');

  return {
    subscribe,

    // Initialize from localStorage or default
    init: () => {
      if (browser) {
        const stored = localStorage.getItem(STORAGE_KEY);
        const isValidMode = homepageLayoutOptions.some((option) => option.id === stored);
        const initialMode = isValidMode ? (stored as HomepageLayoutMode) : 'categories';

        set(initialMode);
        return initialMode;
      }
      return 'categories';
    },

    // Set homepage layout mode and persist to localStorage
    setMode: (mode: HomepageLayoutMode) => {
      const option = homepageLayoutOptions.find((opt) => opt.id === mode);
      if (!option) {
        console.warn(`Homepage layout mode "${mode}" is not valid`);
        return;
      }

      set(mode);

      if (browser) {
        localStorage.setItem(STORAGE_KEY, mode);
      }
    },

    // Get option configuration
    getOption: (mode: HomepageLayoutMode): HomepageLayoutOption | undefined => {
      return homepageLayoutOptions.find((opt) => opt.id === mode);
    },

    // Get all available options
    getAllOptions: (): HomepageLayoutOption[] => {
      return homepageLayoutOptions;
    },
  };
}

export const homepageLayout = createHomepageLayoutStore();
