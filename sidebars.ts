import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

/**
 * Creating a sidebar enables you to:
 - create an ordered group of docs
 - render a sidebar for each doc of that group
 - provide next/previous navigation

 The sidebars can be generated from the filesystem, or explicitly defined here.

 Create as many sidebars as you want.
 */
const sidebars: SidebarsConfig = {
  // Using autogenerated sidebars for user guide
  userGuideSidebar: [{type: 'autogenerated', dirName: 'user-guide'}],
  
  // Using autogenerated sidebars for API
  apiSidebar: [{type: 'autogenerated', dirName: 'api'}],
  
  // Explicitly define SDK sidebar to ensure proper ordering
  sdkSidebar: [
    {
      type: 'category',
      label: 'SDK Documentation',
      link: {
        type: 'doc',
        id: 'sdk/index',
      },
      items: [
        'sdk/installation',
        'sdk/overview',
      ],
    },
  ],
};

export default sidebars;
