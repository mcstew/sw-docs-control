#!/usr/bin/env node

/**
 * Reorganize sudowrite-documentation folder structure to match Featurebase hierarchy
 *
 * NEW STRUCTURE:
 * - getting-started/
 *   - introduction/
 *   - sudowrite-manual/
 * - plans-and-account/
 *   - sudowrite-plans/
 *   - credits/
 *   - your-account/
 * - using-sudowrite/
 *   - features/
 *   - workflows/
 *   - story-bible/
 *   - story-smarts/
 *   - plugins/
 * - resources/
 *   - classes/
 *   - community/
 * - frequently-asked-questions/ (flat - no subcollections)
 * - legal-stuff/
 *   - the-fine-print/
 * - about-sudowrite/
 *   - more-about-us/
 */

const fs = require('fs');
const path = require('path');

const docsDir = path.join(__dirname, '../sudowrite-documentation');
const tempDir = path.join(__dirname, '../sudowrite-documentation-new');

// Create new folder structure
const newStructure = {
  'getting-started': {
    subcollections: ['introduction', 'sudowrite-manual']
  },
  'plans-and-account': {
    subcollections: ['sudowrite-plans', 'credits', 'your-account']
  },
  'using-sudowrite': {
    subcollections: ['features', 'workflows', 'story-bible', 'story-smarts', 'plugins']
  },
  'resources': {
    subcollections: ['classes', 'community']
  },
  'frequently-asked-questions': {
    subcollections: [] // Flat - articles at top level
  },
  'legal-stuff': {
    subcollections: ['the-fine-print']
  },
  'about-sudowrite': {
    subcollections: ['more-about-us']
  }
};

// Mapping of old folder names to new parent collections
const folderMapping = {
  // Getting Started
  'introduction': 'getting-started',
  'sudowrite-manual': 'getting-started',

  // Plans & Account
  'sudowrite-plans': 'plans-and-account',
  'credits': 'plans-and-account',
  'your-account': 'plans-and-account',

  // Using Sudowrite
  'features': 'using-sudowrite',
  'workflows': 'using-sudowrite',
  'story-bible': 'using-sudowrite',
  'story-smarts': 'using-sudowrite',
  'plugins': 'using-sudowrite',

  // Resources
  'classes': 'resources',
  'community': 'resources'
};

// Mapping of loose files to their destinations
const fileMapping = {
  // FAQ articles (go directly into frequently-asked-questions/)
  'can-i-use-sudowrite-in-other-languages.md': 'frequently-asked-questions',
  'is-there-a-mobile-app.md': 'frequently-asked-questions',
  'where-do-i-submit-feedback-or-feature-requests.md': 'frequently-asked-questions',
  'what-accessibility-options-are-available.md': 'frequently-asked-questions',
  'does-sudowrite-have-a-status-page.md': 'frequently-asked-questions',
  'can-i-hide-information-from-the-ai.md': 'frequently-asked-questions',

  // Legal Stuff (go into legal-stuff/the-fine-print/)
  'terms-and-conditions.md': 'legal-stuff/the-fine-print',
  'intellectual-property-and-ownership.md': 'legal-stuff/the-fine-print',
  'privacy-policy.md': 'legal-stuff/the-fine-print',

  // About Sudowrite (go into about-sudowrite/more-about-us/)
  'contact-us.md': 'about-sudowrite/more-about-us'
};

console.log('🗂️  Reorganizing folder structure to match Featurebase...\n');

// Step 1: Create new directory structure
console.log('📁 Creating new folder structure...');
if (fs.existsSync(tempDir)) {
  fs.rmSync(tempDir, { recursive: true });
}
fs.mkdirSync(tempDir);

// Create all main collections and subcollections
for (const [mainCollection, { subcollections }] of Object.entries(newStructure)) {
  const mainPath = path.join(tempDir, mainCollection);
  fs.mkdirSync(mainPath);

  for (const subcollection of subcollections) {
    const subPath = path.join(mainPath, subcollection);
    fs.mkdirSync(subPath);
  }
}

console.log('✅ New folder structure created\n');

// Step 2: Copy existing folders to their new locations
console.log('📦 Moving existing subcollection folders...');
for (const [oldFolder, newParent] of Object.entries(folderMapping)) {
  const oldPath = path.join(docsDir, oldFolder);
  const newPath = path.join(tempDir, newParent, oldFolder);

  if (fs.existsSync(oldPath)) {
    fs.cpSync(oldPath, newPath, { recursive: true });
    console.log(`  ✓ ${oldFolder} → ${newParent}/${oldFolder}`);
  } else {
    console.log(`  ⚠️  ${oldFolder} not found, skipping`);
  }
}

console.log('✅ Folders moved\n');

// Step 3: Copy loose files to their new locations
console.log('📄 Moving loose files...');
for (const [file, destination] of Object.entries(fileMapping)) {
  const oldPath = path.join(docsDir, file);
  const newPath = path.join(tempDir, destination, file);

  if (fs.existsSync(oldPath)) {
    fs.copyFileSync(oldPath, newPath);
    console.log(`  ✓ ${file} → ${destination}/${file}`);
  } else {
    console.log(`  ⚠️  ${file} not found, skipping`);
  }
}

console.log('✅ Files moved\n');

// Step 4: Copy special files and folders
console.log('📋 Copying special files...');
const specialItems = ['.sync-state.json', '.conflicts', 'INDEX.md'];
for (const item of specialItems) {
  const oldPath = path.join(docsDir, item);
  const newPath = path.join(tempDir, item);

  if (fs.existsSync(oldPath)) {
    if (fs.statSync(oldPath).isDirectory()) {
      fs.cpSync(oldPath, newPath, { recursive: true });
    } else {
      fs.copyFileSync(oldPath, newPath);
    }
    console.log(`  ✓ ${item}`);
  }
}

console.log('✅ Special files copied\n');

console.log('============================================================');
console.log('REORGANIZATION COMPLETE!');
console.log('============================================================');
console.log(`Old structure: ${docsDir}`);
console.log(`New structure: ${tempDir}`);
console.log('\nNext steps:');
console.log('1. Review the new structure in sudowrite-documentation-new/');
console.log('2. If it looks good, run:');
console.log('   rm -rf sudowrite-documentation');
console.log('   mv sudowrite-documentation-new sudowrite-documentation');
console.log('3. Update sync scripts to use new structure');
console.log('============================================================');
