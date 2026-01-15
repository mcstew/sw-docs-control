---
title: How do I build Plugins?
slug: 1671769-how-do-i-build-plugins
category: '2165317'
collection_name: Plugins
featurebase_id: '1671769'
last_updated: '2025-09-03T17:27:58.490Z'
synced_at: '2026-01-15T23:11:00.869Z'
source: featurebase
---
## Creating Plugins

Roll up your sleeves and start making some Plugins of your own—for yourself or everyone on Sudowrite! If you know some basics when it comes to writing prompts for AI, building your first Plugin will be easy.

But before you get started, make sure to set your [profile name to what you want publicly displayed](/ba0fd91005c94f589ea6901070ae8bb8?pvs=25#e086bf5404b849c2b89ab240e488094b). Whatever you set here is what will show up as the Creator Name on Plugins you Publish to the Directory.

To get started, click on the Create Plugin button in the top right corner of the plugins list page to get to the plugin creation flow.

### The Basic Editor

![Notion Image](https://66f2e7f2298c40d9d4eb17c1.featurebase-attachments.com/c/article/689f6f0e94da8fb2bf6c0296/0198f175-8a50-7fea-b315-a89ada15d547/b64u-MDE5OGYxNzUtODk5OC03Y2Q1LTliZjAtYWRhODM2Y2ViNzVk.png?X-Amz-Expires=3600&X-Amz-Date=20260115T230000Z&X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=DO801TYC4FCVNNEKURKM%2F20260115%2Ffra1%2Fs3%2Faws4_request&X-Amz-SignedHeaders=host&X-Amz-Signature=44a801b0f2b6f20ad01094b461a8adf0c9b62f2e737c6bc8dae095eba4f86d74)

The Basic Editor is the quickest way to build a Plugin, and you can do so with something as simple as a single prompt.

Here’s what each of the fields pictured above does:

1.  **Name** \- Give your Plugin a unique name. The name should be succinct, and clearly communicate what the Plugin does since this will be the name seen in the dropdown.
    
2.  **Description** - Describe what the Plugin does and include specifics of how to use it. Depending on the Plugin, it may make sense to include an example input and output response.
    
3.  **Visibility** - You can choose to Publish your Plugin or keep it Unlisted. Unlisted plugins do not show up in the Directory or search results, but you can still use them—and anyone with the direct URL would also be able to see/install the Plugin.
    
4.  **Category** - Choose a single option from the options available to categorize your Plugin according to _what it is for_—anything from _Analysis & Feedback_ to _World-Building_. This will determine where the Plugin appears on the Explore page.
    

_The Categories currently available are:_

**Narrative & Plot** - Plugins that focus on creating and/or enhancing the plot.

**Character Development** - Plugins that assist in crafting and refining characters.

**Editing & Revision** - Plugins that improve the writing style and prose.

**Scene Enhancement** - Plugins that help with improving or modifying a scene.

**World-Building** - Plugins that aid in creating immersive and detailed fictional worlds.

**Analysis & Feedback** - Plugins dedicated to providing in-depth evaluations and feedback on written content.

**Marketing** - Plugins designed to aid authors in promoting and distributing their work to a broader audience.

**Genre-Specific** - Plugins that provide guidance and/or prompts tailored to specific genres, such as romance, horror, or young adult fiction.

**Multi-Lingual** - Plugins that help with translation or are narrative tools that are language specific.

5.  **Your Instructions** - This is where you tell the AI exactly what to do. When a user highlights text and then uses your Plugin, the AI will read the text first, and then be prompted with these instructions. Be precise with your instructions, as if it were written for an assistant who cannot ask you follow-up questions while they are doing the task.
    
6.  **Enable Story Bible Data** - If your Plugin could benefit from understanding the user’s Story Bible, enable this and click on the relevant parts of the Story Bible that you’d like to share with the AI. (Maybe the plugin needs to know the genre or style to work optimally—it’s up to you!)
    

> **Good to Know**
> 
> Plugins use **credits**, just like other Sudowrite features, when used. Basic Plugins are generally pretty cost effective, but might get expensive if you decide to pass in the complete contents of someone’s Story Bible.
> 
> Advanced Plugins get way more complex, letting you insert variables where and how you’d like them, toggle between AI models, and even string prompts together in sequence—which means the credit use could vary dramatically.

### Advanced Editor

If you need more control over the prompts, the Advanced Editor gives you precise control over the prompt formatting and various Large Language Model options. You can also create multi-stage prompts (currently up to 2)!

![Notion Image](https://66f2e7f2298c40d9d4eb17c1.featurebase-attachments.com/c/article/689f6f0e94da8fb2bf6c0296/0198f175-e857-7597-8eed-43565203174d/b64u-MDE5OGYxNzUtZTc3YS03NGY3LThmMWYtN2QyY2RkNTg0ODcy.png?X-Amz-Expires=3600&X-Amz-Date=20260115T230000Z&X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=DO801TYC4FCVNNEKURKM%2F20260115%2Ffra1%2Fs3%2Faws4_request&X-Amz-SignedHeaders=host&X-Amz-Signature=132f35d505e291e596d5aa3fb8617aca13f8398b62e67fa033a84af1c5901041)

The Advanced Editor begins to look different from the Basic Editor once you scroll past the visibility and category options.

Here’s what each of the areas in the screenshot above controls:

1.  **Preceding Text** - Preceding Text is a variable representing the words before the cursor. In Basic Plugins this works as a fallback, reading the words before the cursor if the Plugin user had not highlighted anything. If you plan on using `{{ preceding_text }}` then you may want to specify the minimum and/or maximum number of words needed before the cursor for the Plugin to work here.
    
2.  **Highlighted Text** - Highlighted Text is a variable representing the words the user has highlighted—this will be replaced by the exact words the user has highlighted when the Plugin is run, passing that context into the prompt. If you plan on using `{{ highlighted_text }}` you can specify the minimum words required and maximum allowed for a highlight here.
    
3.  **User Text Input** - If you toggle on _Allow Users to Give Instructions_, you also enable the `{{ user_text_input }}` variable. With this feature enabled, your Plugin users will get a popup window before the Plugin is actually run, prompting them for input according to instructions you’ve defined. Inserting this variable in your Plugin instructions is a way to directly pass in end user input.
    
    ![Notion Image](https://66f2e7f2298c40d9d4eb17c1.featurebase-attachments.com/c/article/689f6f0e94da8fb2bf6c0296/0198f177-f932-77b7-8803-4d6762c4035c/b64u-MDE5OGYxNzctZjg3NS03ZDYzLTg0YjAtYzJmM2ViMDk1ZmY0.png?X-Amz-Expires=3600&X-Amz-Date=20260115T230000Z&X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=DO801TYC4FCVNNEKURKM%2F20260115%2Ffra1%2Fs3%2Faws4_request&X-Amz-SignedHeaders=host&X-Amz-Signature=dfe870d2323b0981c5f888215a370ab2afd79321f53115fe64e4bd6b8c52e7e9)

**Available Variables** \- In addition to those discussed above (which have their own configurator inside of the Advanced Plugin builder) there are a bunch of additional variables available to enrich your custom Plugins.

{{ previous\_document\_text }} - The text from all previous documents in the chain of previous documents. This takes advantage of a user’s chapter continuity.

{{ braindump }} - The braindump from the story bible.

{{ genre }} - The genre from the user’s story bible.

{{ style }} - The style from the user’s story bible.

{{ synopsis }} - The synopsis from the user’s story bible.

{{ characters }} - The characters from the user’s story bible, optimized by the Saliency engine to only include textually relevant character data.

{{ characters\_raw }} - All of the character data from the story bible, raw, unoptimized.

{{ outline }} - The outline from the story bible.

{{ scene\_summary }} - The section of the outline linked with the current document a plugin is being used within, if any.

{{ is\_story\_bible\_active }} - Information as to whether or not story bible is toggled on.

{{ chapter\_scenes }} - The Scenes from the story bible.

{{ chapter\_scenes\_extra\_instructions }} - The Extra Instructions that a user has opted to include in their Draft box.

{{ worldbuilding }} - The worldbuilding entries from the story bible, optimized by the Saliency engine to only include what is textually relevant.

{{ worldbuilding\_raw }} - The worldbuilding entries from the story bible, raw, unoptimized.

1.  **Prompts -** By default an Advanced Plugin has a simple Prompt area—**Prompt 1**. Inside of that box you can specify the exact instructions and LLM you’d like.
    
    1.  **System** - This specifies how the AI should behave. For instance, a system message could be: "You are a helpful assistant." This instructs the model to behave like a helpful assistant during the chat.
        
    2.  **User** - This is the substance of your plugin. Here, you will combine the user’s `{{ highlighted_text }}` and possibly the Story Bible data into a prompt for the language model to produce the desired functionality for the user. A few guidelines:
        
        -   Give a strong cue as to what part of the prompt is the user’s highlighted text, which will let the AI know what part is coming from the user. Something like:
            
        
        `Here is a passage of text: {{ highlighted_text }} Based on the passage of text provided, [...rest of instructions...]`
        
        -   Be as specific as you can with your instructions. A good approach is to write this as if you’re writing an email to an assistant for them to do the task correctly on the first try without requiring clarifying questions.
            
        -   If prompt rewrites the user’s highlighted text, specify at the end how long the rewrite should be. If it should be rewriting into approximately the same number of words, say so, like `ONLY REWRITE THE PASSAGE, DO NOT MAKE IT LONGER`
            
        -   The genre, style, synopsis, characters, and outline are available as variables as well, allowing you to inject Story Bible data to influence the prompt.
            
    3.  **AI Options** - These options changes the behavior of the language model selected.
        
        -   **Engine** - You can select from several different AI models. We believe `gpt-4o-mini` is sufficient for most tasks—but much more capable (albeit slower and more expensive) models exist, such as `gpt-4.1` and even `gemini-2.5-pro` which is capable of reading entire manuscripts.
            
        -   **Temperature** - Think of this as the "creativity" dial. A higher temperature (e.g., 1.0) makes the model's responses more random and creative, while a lower temperature (e.g., 0.1) makes them more focused and deterministic. Ranges from `0` to `1.0`. We recommend `0.85` for most use cases.
            
        -   **Frequency Penalty** - Controls how much the model avoids or prefers frequently used words or phrases. A negative value makes it more likely to use frequent words, while a positive value makes it avoid them. It's like asking a writer to avoid clichés: a positive value tells them to be more original and not use common phrases, while a negative value lets them use those familiar phrases freely.
            
        -   **Presence Penalty** - This adjusts the model's inclination to include new ideas or topics. A positive value encourages it to introduce new concepts, while a negative value makes it stick more closely to the topics already mentioned. Imagine instructing a teacher: a positive value tells them to bring up new topics often, while a negative one tells them to stay on the current topic.
            
        -   **Stop** - This parameter lets you specify words that, when generated by the model, will make it stop generating any further. For instance, if you set "stop" to be ".", the model would stop generating text as soon as it produces a period. It's like giving a speaker a cue: "When you mention this word or symbol, wrap up your speech.”
            
        -   **Number of Generations** \- The number of cards your plugin should generate. Each card is an independent “run” of your plugin, and do not affect each other. Specifying more than one is useful if you want to give the user a diverse set of options to choose from. (Note: multi-stage prompts require this to be 1)
            
        -   **Max Tokens** - This determines the maximum number of tokens the model will produce in its output (where a token is roughly 0.75 words). For example, if you set "max tokens" to 50, the model will not generate a response longer than 50 tokens.
            

2.  **Multi-Stage Prompts** - To create multi-stage prompts—which are essentially two of these in sequence—you can click on the “+ Prompt” button at the bottom, which will create a new prompt. The second stage is exactly the same as the first, except now you have access to a new variable `{{ prompt_1_result }}` which will be the output from the first prompt. This is great if you’d like to run an analysis, and the use that analysis to run an edit or text transformation in the following prompt.
    
    1.  Note that while you will see the prompt 1 result in testing, only the end result of the second prompt will be output to a card in the user’s History when a live Plugin is used. This means users will not see the intermediate prompt results. (In the example above, the end user would not see the analysis, only the transformed text.)
        

**Heads Up** Once you start editing your Plugin in the Advanced Editor, you may not be able to go back to the Basic Editor—especially if you use options that the Basic Editor does not support.

## Testing Plugins

At the bottom of the Plugin creation page, you will see a testing area:

![Notion Image](https://66f2e7f2298c40d9d4eb17c1.featurebase-attachments.com/c/article/689f6f0e94da8fb2bf6c0296/0198f17d-7f32-71ce-8b0e-c47e75fb936e/b64u-MDE5OGYxN2QtN2VmMi03YjhjLThkNjctN2NhM2VlYWEzMzkw.png?X-Amz-Expires=3600&X-Amz-Date=20260115T230000Z&X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=DO801TYC4FCVNNEKURKM%2F20260115%2Ffra1%2Fs3%2Faws4_request&X-Amz-SignedHeaders=host&X-Amz-Signature=766c1ab313182c96a0e978ad3198416989bb097ca6abe723194228ddb63b2b92)

This lets you easily and quickly test your Plugin without publishing it. It’s essential that you test your plugin to make sure it works with a diverse set of inputs—and that you’re getting the results you want out of it. We suggest that you have a bank of inputs along with an idea what your expected output is. This way, as you iterate on the design of your plugin, you can make sure that the functionality matches your expectations.

Toggling Additional Variables exposes fields to populate Preceding Text as well as any Story Bible test data (in case your Plugin makes use of those). Note that we’ve pre-populated some Story Bible context for quick testing, but you can replace that with more tailored inputs for better results. (If you notice your Plugin is talking a lot about Bigfoot in testing, it’s possible you’re passing in this context without realizing it!)

## Profile Name

You can edit what name shows up for your Plugins by clicking on the small “Edit” link in the Settings (⚙️) menu in top right of your Sudowrite interface:

![Notion Image](https://66f2e7f2298c40d9d4eb17c1.featurebase-attachments.com/c/article/689f6f0e94da8fb2bf6c0296/0198f17d-f4a7-7d85-818b-02fe918e4d56/b64u-MDE5OGYxN2QtZjQxOS03ZjdlLWI4NzQtZmFiYjBkZGYzMjBm.png?X-Amz-Expires=3600&X-Amz-Date=20260115T230000Z&X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=DO801TYC4FCVNNEKURKM%2F20260115%2Ffra1%2Fs3%2Faws4_request&X-Amz-SignedHeaders=host&X-Amz-Signature=5314d008136e54b6daddd6381c55765ac7edf391565556738cbd2ae71b4de51f)

By default, if you’ve logged in via Google, that will be set to your Google display name.

### Example - Summarize Plot Points

## How does the Saliency Engine work with Plugins?

Some plugins are designed to use your Story Bible data. In those cases, Saliency Engine may or may not be used, depending entirely on how the creator built that plugin.

-   If the creator chose to use the `{{ characters }}` or `{{ worldbuilding }}` variables, the Saliency Engine **will** kick in when necessary.
    
-   If the creator chose to use the `{{ characters_raw }}` or `{{ worldbuilding_raw }}` variables, the full context of those fields will be passed along into the AI in their entirety. The Saliency Engine will make no attempt to parse the data for relevant context.
    
    -   Note: In most cases, the `raw` version will give the AI _way_ more context. This can either degrade or improve the results, depending on both the plugin configuration and the context passed through as a result… but it will almost always make the Plugin use more credits.
        
    -   **Hidden characters or traits will never be visible to the AI**, even if a Plugin is using the a `raw` variable.
        

> Be Advised: Credit cost is always calculated based on input, output, and the model selected. If a user with hundreds of Characters or Worldbuilding Elements uses a Plugin that includes the `raw` version of a variable, a great deal of context will be passed through to the AI. **This could consume a ton of credits!**

All Plugins that predate the Saliency Engine use the standard `{{ characters }}` variable, and so will use Saliency Engine by default.
