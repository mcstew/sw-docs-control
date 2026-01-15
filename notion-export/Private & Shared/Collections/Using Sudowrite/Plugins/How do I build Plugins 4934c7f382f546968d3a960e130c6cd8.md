# How do I build Plugins?

Last Updated: March 20, 2024
Published: Yes
Suggested: No

## Creating Plugins

Roll up your sleeves and start making some Plugins of your own—for yourself or everyone on Sudowrite! If you know some basics when it comes to writing prompts for AI, building your first Plugin will be easy.

But before you get started, make sure to set your profile name to what you want publicly displayed. You can do so by clicking the Settings Gear icon in the upper right of Sudowrite and clicking Edit next to the name that appears in the top left of that popup. Whatever you set here is what will show up as the Creator Name on Plugins you Publish to the Directory.

To get started, click on the **Create Plugin** button in the **More Tools** dropdown, or else on the right of the Plugins Directory. Either way, you’ll be put into the plugin creation flow.

### **The Magic Plugin Builder**

We’ve simplified the plugin creation flow so that you can just describe what exactly you’d like a plugin to do.

![CleanShot 2026-01-14 at 16.00.55@2x.png](../../../../Sudowrite/464bbb10ed2c49c49d13490fb9c423e4/Public%20Docs/Plugins%20Guide/CleanShot_2026-01-14_at_16.00.552x.png)

To use it, enter a plain text description of what sort of writing tool you’re looking for and click Generate Plugin. Remember that plugins can do any of three things: generate, analyze, or transform text. (The Magic Plugin Builder won’t create multi-stage plugins by default, but it’s worth noting that you can create a 2-stage plugin in case you’d like to do any of those things in sequence too!)

The Basic Editor is the quickest way to build a Plugin, and you can do so with something as simple as a single prompt.

Here’s what each of the fields pictured above does:

1. **Name** - Give your Plugin a unique name. The name should be succinct, and clearly communicate what the Plugin does since this will be the name seen in the dropdown.
2. **Description** - Describe what the Plugin does and include specifics of how to use it. Depending on the Plugin, it may make sense to include an example input and output response.
3. **Visibility** - You can choose to Publish your Plugin or keep it Unlisted. Unlisted plugins do not show up in the Directory or search results, but you can still use them—and anyone with the direct URL would also be able to see/install the Plugin.
4. **Category** - Choose a single option from the options available to categorize your Plugin according to *what it is for*—anything from *Analysis & Feedback* to *World-Building*. This will determine where the Plugin appears on the Explore page.
    - *The Categories currently available are:*
        
        **Narrative & Plot** - Plugins that focus on creating and/or enhancing the plot.
        **Character Development** - Plugins that assist in crafting and refining characters.
        **Editing & Revision** - Plugins that improve the writing style and prose.
        Scene Enhancement - Plugins that help with improving or modifying a scene.
        **World-Building** - Plugins that aid in creating immersive and detailed fictional worlds.
        **Analysis & Feedback** - Plugins dedicated to providing in-depth evaluations and feedback on written content.
        **Marketing** - Plugins designed to aid authors in promoting and distributing their work to a broader audience.
        **Genre-Specific** - Plugins that provide guidance and/or prompts tailored to specific genres, such as romance, horror, or young adult fiction.
        **Multi-Lingual** - Plugins that help with translation or are narrative tools that are language specific.
        
5. **Your Instructions** - This is where you tell the AI exactly what to do. When a user highlights text and then uses your Plugin, the AI will read the text first, and then be prompted with these instructions. Be precise with your instructions, as if it were written for an assistant who cannot ask you follow-up questions while they are doing the task.
6. **Enable Story Bible Data** - If your Plugin could benefit from understanding the user’s Story Bible, enable this and click on the relevant parts of the Story Bible that you’d like to share with the AI. (Maybe the plugin needs to know the genre or style to work optimally—it’s up to you!)

<aside>
🧠 **Good to Know**
Plugins use **credits**, just like other Sudowrite features, when used. Basic Plugins are generally pretty cost effective, but might get expensive if you decide to pass in the complete contents of someone’s Story Bible.
Advanced Plugins get way more complex, letting you insert variables where and how you’d like them, toggle between AI models, and even string prompts together in sequence—which means the credit use could vary dramatically.

</aside>

**Advanced Editor**

If you need more control over the prompts, the Advanced Editor gives you precise control over the prompt formatting and various Large Language Model options. You can also create multi-stage prompts (currently up to 2)!

![The Advanced Editor begins to look different from the Basic Editor once you scroll past the visibility and category options.](../../../../Sudowrite/464bbb10ed2c49c49d13490fb9c423e4/Public%20Docs/Plugins%20Guide/CleanShot_2025-05-29_at_12.46.44(3).png)

The Advanced Editor begins to look different from the Basic Editor once you scroll past the visibility and category options.

Here’s what each of the areas in the screenshot above controls:

1. **Preceding Text** - Preceding Text is a variable representing the words before the cursor. In Basic Plugins this works as a fallback, reading the words before the cursor if the Plugin user had not highlighted anything. If you plan on using `{{ preceding_text }}` then you may want to specify the minimum and/or maximum number of words needed before the cursor for the Plugin to work here.
2. **Highlighted Text** - Highlighted Text is a variable representing the words the user has highlighted—this will be replaced by the exact words the user has highlighted when the Plugin is run, passing that context into the prompt. If you plan on using `{{ highlighted_text }}` you can specify the minimum words required and maximum allowed for a highlight here.
3. **User Text Input** - If you toggle on *Allow Users to Give Instructions*, you also enable the `{{ user_text_input }}` variable. With this feature enabled, your Plugin users will get a popup window before the Plugin is actually run, prompting them for input according to instructions you’ve defined. Inserting this variable in your Plugin instructions is a way to directly pass in end user input.
    
    ![CleanShot 2024-06-19 at 11.12.42@2x.png](../../../../Sudowrite/464bbb10ed2c49c49d13490fb9c423e4/Public%20Docs/Plugins%20Guide/CleanShot_2024-06-19_at_11.12.422x.png)
    

<aside>
💱

**Available Variables** - In addition to those discussed above (which have their own configurator inside of the Advanced Plugin builder) there are a bunch of additional variables available to enrich your custom Plugins.
`{{ previous_document_text }}` - The text from all previous documents in the chain of previous documents. This takes advantage of a user’s chapter continuity.
`{{ braindump }}` - The braindump from the story bible.
`{{ genre }}` - The genre from the user’s story bible.
`{{ style }}` - The style from the user’s story bible.
`{{ synopsis }}` - The synopsis from the user’s story bible.
`{{ characters }}` - The characters from the user’s story bible, optimized by the Saliency engine to only include textually relevant character data.
`{{ characters_raw }}` - All of the character data from the story bible, raw, unoptimized.
`{{ outline }}` - The outline from the story bible.
`{{ scene_summary }}` - The section of the outline linked with the current document a plugin is being used within, if any.
`{{ is_story_bible_active }}` - Information as to whether or not story bible is toggled on.
`{{ chapter_scenes }}` - The Scenes from the story bible.
`{{ chapter_scenes_extra_instructions }}` - The Extra Instructions that a user has opted to include in their Draft box.
`{{ worldbuilding }}` - The worldbuilding entries from the story bible, optimized by the Saliency engine to only include what is textually relevant.
`{{ worldbuilding_raw }}` - The worldbuilding entries from the story bible, raw, unoptimized.

</aside>

1. **Prompts -** By default an Advanced Plugin has a simple Prompt area—**Prompt 1**. Inside of that box you can specify the exact instructions and LLM you’d like.
    1. **System** - This specifies how the AI should behave. For instance, a system message could be: "You are a helpful assistant." This instructs the model to behave like a helpful assistant during the chat.
    2. **User** - This is the substance of your plugin. Here, you will combine the user’s `{{ highlighted_text }}`  and possibly the Story Bible data into a prompt for the language model to produce the desired functionality for the user. A few guidelines:
        - Give a strong cue as to what part of the prompt is the user’s highlighted text, which will let the AI know what part is coming from the user. Something like:
        
        ```
        Here is a passage of text:
        
        {{ highlighted_text }}
        
        Based on the passage of text provided, [...rest of instructions...]
        ```
        
        - Be as specific as you can with your instructions. A good approach is to write this as if you’re writing an email to an assistant for them to do the task correctly on the first try without requiring clarifying questions.
        - If prompt rewrites the user’s highlighted text, specify at the end how long the rewrite should be. If it should be rewriting into approximately the same number of words, say so, like `ONLY REWRITE THE PASSAGE, DO NOT MAKE IT LONGER`
        - The genre, style, synopsis, characters, and outline are available as variables as well, allowing you to inject Story Bible data to influence the prompt.
    3. **AI Options** - These options changes the behavior of the language model selected. 
        1. **Engine** - You can select from several different AI models. We believe `gpt-4o-mini` is sufficient for most tasks—but much more capable (albeit slower and more expensive) models exist, such as `gpt-4.1` and even `gemini-2.5-pro` which is capable of reading entire manuscripts.
        2. **Temperature** - Think of this as the "creativity" dial. A higher temperature (e.g., 1.0) makes the model's responses more random and creative, while a lower temperature (e.g., 0.1) makes them more focused and deterministic. Ranges from `0` to `1.0`. We recommend `0.85` for most use cases.
        3. **Frequency Penalty** - Controls how much the model avoids or prefers frequently used words or phrases. A negative value makes it more likely to use frequent words, while a positive value makes it avoid them. It's like asking a writer to avoid clichés: a positive value tells them to be more original and not use common phrases, while a negative value lets them use those familiar phrases freely.
        4. **Presence Penalty** - This adjusts the model's inclination to include new ideas or topics. A positive value encourages it to introduce new concepts, while a negative value makes it stick more closely to the topics already mentioned. Imagine instructing a teacher: a positive value tells them to bring up new topics often, while a negative one tells them to stay on the current topic.
        5. **Stop** - This parameter lets you specify words that, when generated by the model, will make it stop generating any further. For instance, if you set "stop" to be ".", the model would stop generating text as soon as it produces a period. It's like giving a speaker a cue: "When you mention this word or symbol, wrap up your speech.”
        6. **Number of Generations** - ****The number of cards your plugin should generate. Each card is an independent “run” of your plugin, and do not affect each other. Specifying more than one is useful if you want to give the user a diverse set of options to choose from. (Note: multi-stage prompts require this to be 1)
        7. **Max Tokens** - This determines the maximum number of tokens the model will produce in its output (where a token is roughly 0.75 words). For example, if you set "max tokens" to 50, the model will not generate a response longer than 50 tokens.
2. **Multi-Stage Prompts** - To create multi-stage prompts—which are essentially two of these in sequence—you can click on the “+ Prompt” button at the bottom, which will create a new prompt. The second stage is exactly the same as the first, except now you have access to a new variable `{{ prompt_1_result }}` which will be the output from the first prompt. This is great if you’d like to run an analysis, and the use that analysis to run an edit or text transformation in the following prompt.
    1. Note that while you will see the prompt 1 result in testing, only the end result of the second prompt will be output to a card in the user’s History when a live Plugin is used. This means users will not see the intermediate prompt results. (In the example above, the end user would not see the analysis, only the transformed text.)

<aside>
⚙ **Heads Up**
Once you start editing your Plugin in the Advanced Editor, you may not be able to go back to the Basic Editor—especially if you use options that the Basic Editor does not support.

</aside>

## Testing Plugins

At the bottom of the Plugin creation page, you will see a testing area:

![CleanShot 2024-01-19 at 18.03.37.png](../../../../Sudowrite/464bbb10ed2c49c49d13490fb9c423e4/Public%20Docs/Plugins%20Guide/CleanShot_2024-01-19_at_18.03.37.png)

This lets you easily and quickly test your Plugin without publishing it. It’s essential that you test your plugin to make sure it works with a diverse set of inputs—and that you’re getting the results you want out of it. We suggest that you have a bank of inputs along with an idea what your expected output is. This way, as you iterate on the design of your plugin, you can make sure that the functionality matches your expectations.

Toggling Additional Variables exposes fields to populate Preceding Text as well as any Story Bible test data (in case your Plugin makes use of those). Note that we’ve pre-populated some Story Bible context for quick testing, but you can replace that with more tailored inputs for better results. (If you notice your Plugin is talking a lot about Bigfoot in testing, it’s possible you’re passing in this context without realizing it!)

## Profile Name

You can edit what name shows up for your Plugins by clicking on the small “Edit” link in the Settings (⚙️) menu in top right of your Sudowrite interface:

![Untitled](../../../../Sudowrite/464bbb10ed2c49c49d13490fb9c423e4/Public%20Docs/Plugins%20Guide/Untitled.png)

By default, if you’ve logged in via Google, that will be set to your Google display name. 

### Example - Summarize Plot Points

Now let’s run through an example - let’s make a Plugin that summarizes the user’s highlighted passage into specific plot points. We’ll use the Basic Editor like so:

**Name** - `Summarize Plot Points` 

*This name makes it clear to the user what the plugin does. It also uses the active voice, which makes it more suited as an action in the dropdown.*

**Description**

```
This plugin summarizes the highlighted text, focusing on story plot points. These plot points could be used as part of an outline, input to Story Engine beats, or for your own notes about a scene.

Example Usage

Input: 
Hours later, we had gotten used to the roar, and people had stopped stirring.
I heard a soft thumping sound, which I took as another piece of debris glancing off the dome top. But then, a musty smell hit my nostrils. A swell of dust blew in from under the antechamber door, followed by another thump, a deep tone that rang from under the dome.
“What was that?” Rosa said.
“The passage,” Yan-Yan said. Inside the chamber, a musty smell hung in the air, and silt stung my eyes. It piled around our legs.
Rosa shuddered. “What’s happening?”
“Pressure differential.” I knew the dust meant the passage must have collapsed.
We huddled and watched the trap door disgorge a concoction of sand and dirt. A faint voice called out, like it was coming from the end of a tin can phone.
Yan-Yan slapped the ground. “Jack! Stay where you are, we’re coming!”
Tina knelt down with her. “Who’s Jack?”
“Her son,” I said. “He’s in the smaller dome, across the way.” I tapped a control panel on the wall, and it immediately blinked an angry red. Power totally out at Dome 2. I switched to the outside camera.
Something had taken a chunk out of the dome.
Yan-Yan’s eyes were wide. “Oh my god.” 
“I thought you said it’d withstand,” Ben said.
A million niggling edge cases stabbed my mind. Perhaps I should have reinforced the pole trusses. Or maybe the ventilation system wasn’t properly sealed. Too late now.
“I’ll get him,” I said.
“I’m going with you,” Yan-Yan said, her fists clenched and shaking.
I shook my head. “Not with your leg.” The wind dial was cracking 120. “Does Jack have his gear?”
“Yes, but he’s still too light,” she said.
She was right. I reckoned he was sixty pounds. Would blow away without being tethered. If the wind cracks 150, even I wouldn’t be able to walk outside. I needed someone to go with me.

Output:
1. Characters are inside a dome when a disturbance, signaled by a musty smell and dust, occurs.
2. Rosa and Yan-Yan identify the disturbance as coming from a collapsed passage.
3. A faint voice from the second dome is recognized as Yan-Yan's son, Jack.
4. Surveillance reveals significant damage to the second dome, prompting concern and regret about the dome's design.
5. The protagonist decides to rescue Jack, with Yan-Yan eager to join despite her injury.
6. The outside environment's strong winds pose a serious threat to the rescue mission, especially considering Jack's light weight.
```

Here, we describe clearly what the plugin does, and also give the user context on when it could be useful. We also give an example input and output, which will help the user understand how this plugin could fit into their workflow.

**Prompt**

```
Summarize this passage into story plot points that would be suitable as part of a story outline. Keep the number of plot points succinct. You should format the output into a numbered list.
```

We make sure to give specific instructions so that the AI knows what kind of output is expected. A good way to approach writing these instructions is to think about what you’d have to write in an email to an assistant to make sure they get the job done without needing to ask clarifying questions.

## How does the Saliency Engine work with Plugins?

Some plugins are designed to use your Story Bible data. In those cases, Saliency Engine may or may not be used, depending entirely on how the creator built that plugin.

- If the creator chose to use the `{{ characters }}` or `{{ worldbuilding }}` variables, the Saliency Engine will kick in when necessary.
- If the creator chose to use the `{{ characters_raw }}` or `{{ worldbuilding_raw }}` variables, the full context of those fields will be passed along into the AI in their entirety. The Saliency Engine will make no attempt to parse the data for relevant context.
    - Note: In most cases, the `*_*raw` version will give the AI *way* more context. This can either degrade or improve the results, depending on both the plugin configuration and the context passed through as a result… but it will almost always make the Plugin use more credits.
    - **Hidden characters or traits will never be visible to the AI**, even if a Plugin is using the a `_raw` variable.

<aside>
🚧 **Be Advised:** Credit cost is always calculated based on input, output, and the model selected. If a user with hundreds of Characters or Worldbuilding Elements uses a Plugin that includes the `_raw` version of a variable, a great deal of context will be passed through to the AI. **This could consume a ton of credits!**

</aside>

All Plugins that predate the Saliency Engine use the standard `{{ characters }}` variable, and so will use Saliency Engine by default.