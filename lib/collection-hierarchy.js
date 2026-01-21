/**
 * Featurebase Collection Hierarchy Mapping
 *
 * Maps Featurebase collection IDs to the proper folder structure
 * Format: collection_id -> { mainCollection, subcollection }
 */

export const COLLECTION_HIERARCHY = {
  // Getting Started
  '7475072': { main: 'getting-started', sub: 'introduction' },            // Introduction
  '6149413': { main: 'getting-started', sub: 'sudowrite-manual' },        // Sudowrite Manual

  // Plans & Account
  '6550900': { main: 'plans-and-account', sub: 'sudowrite-plans' },       // Sudowrite Plans
  '5445363': { main: 'plans-and-account', sub: 'credits' },               // Credits
  '4304666': { main: 'plans-and-account', sub: 'your-account' },          // Your Account

  // Using Sudowrite
  '5442133': { main: 'using-sudowrite', sub: 'features' },                // Features
  '5279540': { main: 'using-sudowrite', sub: 'workflows' },               // Workflows
  '9773420': { main: 'using-sudowrite', sub: 'story-bible' },             // Story Bible
  '5566496': { main: 'using-sudowrite', sub: 'story-smarts' },            // Story Smarts
  '2165317': { main: 'using-sudowrite', sub: 'plugins' },                 // Plugins

  // Resources
  '5844132': { main: 'resources', sub: 'classes' },                       // Classes
  '8291256': { main: 'resources', sub: 'community' },                     // Community

  // Frequently Asked Questions (flat - no subcollection)
  '4621459': { main: 'frequently-asked-questions', sub: null },           // FAQ

  // Legal Stuff
  '4964533': { main: 'legal-stuff', sub: 'the-fine-print' },              // The Fine Print

  // About Sudowrite
  '8861565': { main: 'about-sudowrite', sub: 'more-about-us' }            // More About Us
};

/**
 * Get the folder path for a collection ID
 */
export function getCollectionPath(collectionId) {
  const hierarchy = COLLECTION_HIERARCHY[collectionId];

  if (!hierarchy) {
    console.warn(`Warning: Unknown collection ID ${collectionId}, using 'uncategorized'`);
    return { main: 'uncategorized', sub: null };
  }

  return hierarchy;
}

/**
 * Build the full file path for an article
 */
export function buildArticlePath(collectionId, filename) {
  const { main, sub } = getCollectionPath(collectionId);

  if (sub) {
    return `${main}/${sub}/${filename}`;
  }

  return `${main}/${filename}`;
}
