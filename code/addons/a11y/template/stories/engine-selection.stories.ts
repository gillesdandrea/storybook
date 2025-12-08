import { global as globalThis } from '@storybook/global';

export default {
  component: globalThis.__TEMPLATE_COMPONENTS__.Html,
  args: {
    content: '<button>Click Me!</button>',
  },
  parameters: {
    chromatic: { disable: true },
  },
};

export const AxeCoreEngine = {
  args: {
    content: '<button style="color: rgb(255, 255, 255); background-color: rgb(76, 175, 80);">Click me!</button>',
  },
  parameters: {
    a11y: {
      engine: 'axe-core',
    },
  },
};

export const EqualAccessEngine = {
  args: {
    content: '<button style="color: rgb(255, 255, 255); background-color: rgb(76, 175, 80);">Click me!</button>',
  },
  parameters: {
    a11y: {
      engine: 'equal-access',
    },
  },
};

// Made with Bob
