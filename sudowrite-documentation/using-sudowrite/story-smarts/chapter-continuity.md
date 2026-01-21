---
title: Chapter Continuity
slug: 8989228-chapter-continuity
category: '5566496'
collection_name: Story Smarts
featurebase_id: '8989228'
last_updated: '2025-09-03T18:33:02.782Z'
synced_at: '2026-01-15T23:11:00.891Z'
source: featurebase
---
**Chapter Continuity is a feature that allows you to sequence your documents**, telling Sudowrite which chapter came before which. By linking chapters together, you enable Sudowrite’s AI to treat those separate documents as one continuous story—allowing tools like **Write** and **Draft** to draw on prior context and create smoother transitions, clearer character arcs, and more consistent narratives throughout your work.

## What Chapter Continuity Does

When you define preceding documents in the document linking tool, those documents will be included as additional context for the AI when using certain AI features. Our AI tools—especially Write and Draft—work best when they can draw on previous events, tone, and story structure. Linking your documents ensures that context from earlier chapters helps shape what comes next.

![Notion Image](https://66f2e7f2298c40d9d4eb17c1.featurebase-attachments.com/c/article/689f6dcf04f5d5e47045c14e/0198f172-d5ac-7d30-a1b0-54cdca35d58a/b64u-MDE5OGYxNzItZDRiMi03OGU4LTg2MDAtZDQxZjk0NmFmMzZj.png?X-Amz-Expires=3600&X-Amz-Date=20260115T230000Z&X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=DO801TYC4FCVNNEKURKM%2F20260115%2Ffra1%2Fs3%2Faws4_request&X-Amz-SignedHeaders=host&X-Amz-Signature=63bd6b470d6277a79afadac43fc5e0b1fdef675faa876c8e72d092d673cd59f8)

## How to Link Chapters

To create a link between two documents, click the **three dot (•••) menu** that appears next to the document title in your project’s text editor. The Document Linking Menu will appear with two questions:

-   Is this document in your Outline?
    
-   Does this document continue another one?
    

Linking the document to your Outline tells Sudowrite which chapter _this_ document is supposed to be. That context will be used by tools like Write, Draft, Quick Edit, and Chat. Meanwhile, you can select **Connect it** and choose the prior chapter from the dropdown that appears to tell Sudowrite which document precedes this one.

Once you’ve made these selections, the relationships are saved and will remain visible in the Document Linking Menu. You can change or remove this connection—by selecting Disconnect from the dropdown—at any time.

You can continue a document from any other document in your project, whether or not those documents are linked to your Story Bible’s Outline. That said, linking documents _and_ Outline chapter summaries will give Sudowrite even richer context.

![Notion Image](https://66f2e7f2298c40d9d4eb17c1.featurebase-attachments.com/c/article/689f6dcf04f5d5e47045c14e/0198f173-2aa0-7e5a-9e07-ef4435b3e966/b64u-MDE5OGYxNzMtMjllMS03YmQ4LWIxMDAtNGI0YTgyZDJjNTdi.png?X-Amz-Expires=3600&X-Amz-Date=20260115T230000Z&X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=DO801TYC4FCVNNEKURKM%2F20260115%2Ffra1%2Fs3%2Faws4_request&X-Amz-SignedHeaders=host&X-Amz-Signature=2b3dfa93dbde3479818e1b4f87937707b8515faefe148c3db16ad2e4283f66c7)

## Automatic Linking from the Outline

If you’re generating new chapters from your Outline, Sudowrite will automatically attempt to link them in sequence. For example, if you create Chapter 2 (from either the **\+ New** menu or your Story Bible’s Outline) and there’s already a linked Chapter 1 in the project, Chapter 2 will be created with the Outline’s chapter summary linked and Chapter 1 set as the preceding document. If you skip creating some chapters in the middle—for example, you jump ahead to Chapter 5—Sudowrite will look back for the most recent connected chapter and link to that.

These automatic links are there for your convenience, but you can always change the selections or disconnect a document altogether. This is especially useful for stories with alternating points of view, nonlinear timelines, or other custom structures. It’s also helpful to know that creating a Blank document from the + New menu will create a document without this automatic linking—there will no linked Outline or preceding chapter by default (but you can still make those selections later, if desired).

## Chapter Continuity in Write

When you click the **Write** button in a document that’s linked to a previous one, Sudowrite pulls in up to **20,000 words** of text total from that linked document. If you have several documents connected in series, Write will look at up to **25 previous documents**, starting from the most recent and moving backward until it hits either the word or document limit.

> **For example**, if I’m using the Write button in Chapter 5, and I’ve updated the “Continues from…” setting in each preceding document, the Write button will read Chapter 4, 3, 2, and 1 before it generates. If I had an epic 30,000 word Chapter 4 (for some reason) Write would only read back 20,000 words into Chapter 4.

Write also pulls in up to 20,000 words from the current document—again, starting at the end (or, the cursor position where you’re using the Write feature) and working backward.

This allows Write to stay grounded in the events, characters, and voice of your earlier chapters, with a bias towards the more recent/relevant developments when there’s too much context. Your Write card will include a set of **chiclets** that shows which documents were included, and how many words of each.

![Notion Image](https://66f2e7f2298c40d9d4eb17c1.featurebase-attachments.com/c/article/689f6dcf04f5d5e47045c14e/0198f173-6cdd-717c-ab69-eaf64b6a19df/b64u-MDE5OGYxNzMtNmM0ZC03ODY5LWFlNWYtMmMwYzcxMzQ5MGNi.png?X-Amz-Expires=3600&X-Amz-Date=20260115T230000Z&X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=DO801TYC4FCVNNEKURKM%2F20260115%2Ffra1%2Fs3%2Faws4_request&X-Amz-SignedHeaders=host&X-Amz-Signature=c6763991ba0a86e015932071f434909c9297ec35de03bab00f7162c0e822faee)

## Chapter Continuity in Draft

The **Draft** tool also takes full advantage of Chapter Continuity, both when generating Scenes and when writing chapter prose. If your document is linked to a previous chapter, Draft will look backwards through up to 25 documents and incorporate up to 20,000 words of prior content, as with Write. This helps Draft maintain story cohesion, character arcs, and narrative consistency. It also helps the AI make more logical choices in places where it may not have sufficient guidance from you.

As with Write, the most recent documents in the established sequence will be prioritized. In projects with very large chapters or complex continuity chains, some scene-specific context may be crowded out—especially if the AI needs to make room for long chapters. You can always verify what was included in the chiclets of the Draft card created in your History column.

☝ It’s possible for the AI to “max out” on the context you’re trying to show it. Rather than fail, in those cases the AI will proceed by excluding context in the following sequence.

Excluded in order from top to bottom

-   Worldbuilding
    
-   Characters
    
-   Previous Chapter Text
    
-   Linked Outline Summary
    
-   Genre
    
-   Key Details
    
-   Tone
    
-   Style
    
-   Preceding Text from the current document
    
-   Highlighted Text.
    

Write always includes as much as possible—partial inputs from these bits of context may still be passed to the AI when the full ones don’t fit.

## Chapter Continuity Best Practices

Use Chapter Continuity to keep your longform work coherent, but don’t feel constrained by it. Manual linking gives you full control and works well for flexible story structures. Automatic linking is helpful for straightforward chapter sequences based on your Outline, but it’s always editable.

If your Write or Draft results seem off—missing key characters or important events—check the chiclets to see what context was included. Trimming your current document or adjusting linked content can improve performance.
