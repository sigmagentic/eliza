export const twitterPostHoldingsTemplate = `
# Areas of Expertise
{{knowledge}}

# About {{agentName}} (@{{twitterUserName}}):
{{bio}}
{{lore}}
{{topics}}

{{providers}}

{{characterPostExamples}}

{{postDirections}}

# Task: Generate a post in the voice and style and perspective of {{agentName}} @{{twitterUserName}} about an enthusiastic music nft drop/release announcement.
Your response should be 1 or 2 sentences (choose the length at random).
Write a social media post that announces and celebrates receiving a new music nft, following these parameters:

Artist: {{artist}}
Total Tracks: {{totalTracks}}
Audio Preview: {{audioPreview}}

Guidelines:
- Write in natural sentences (avoid "featuring X tracks" or listing details)
- Keep it conversational and fluid
- Inform that the music was dropped in the sigmamusic.fm app. make sure the exact name (sigmamusic.fm) of the app is used.
- Place preview link at the end
- Maintain excitement without formal announcement structure
- No "I'm excited to announce" or similar formal phrases

Example format:
"Just dropped a new album by {{artist}} on sigmamusic.fm 🎵 The album has {{totalTracks}} tracks, preview a sample here: {{audioPreview}}"

Instead of:
"I'm thrilled to announce that I've acquired [album name] featuring [X] tracks..."

Write the announcement without any additional commentary or meta-discussion. Generate only the announcement post itself.
Your response should not contain any questions. Brief, concise statements only.The total character count MUST be less than {{maxTweetLength}}. No emojis. Use \\n\\n (double spaces) between statements if there are multiple statements in your response.`;

export const twitterPostTensorListingsTemplate = `
# Areas of Expertise
{{knowledge}}

# About {{agentName}} (@{{twitterUserName}}):
{{bio}}
{{lore}}
{{topics}}

{{providers}}

{{characterPostExamples}}

{{postDirections}}

# Task: Generate a post in the voice and style and perspective of {{agentName}} @{{twitterUserName}} about a new listing on Tensor of a music nft from an artist you represent.
Your response should be 1 or 2 sentences (choose the length at random).
Write a social media post that announces a new music nft listing from an artist you represent on Tensor, following these parameters:

assetId: {{assetId}}
time since listing: {{timeline}}
url: {{url}}

Guidelines:
- Write in natural sentences
- Keep it conversational and fluid
- Place url at the end
- Maintain excitement without formal announcement structure
- Must not mention the {{assetId}}
- No "I'm excited to announce" or similar formal phrases

Example format:
"dope! a new listing on the music nft collection of tensor. check it out: {{url}}"

Write the announcement without any additional commentary or meta-discussion. Generate only the announcement post itself.
Your response should not contain any questions. Brief, concise statements only.The total character count MUST be less than {{maxTweetLength}}. No emojis. Use \\n\\n (double spaces) between statements if there are multiple statements in your response.`;

export const twitterPostTensorBuysTemplate = `
# Areas of Expertise
{{knowledge}}

# About {{agentName}} (@{{twitterUserName}}):
{{bio}}
{{lore}}
{{topics}}

{{providers}}

{{characterPostExamples}}

{{postDirections}}

# Task: Generate a post in the voice and style and perspective of {{agentName}} @{{twitterUserName}} about a recent purchase on Tensor of a music nft from an artist you represent.
Your response should be 1 or 2 sentences (choose the length at random).
Write a social media post that announces and celebrates someone purchased a music nft from an artist you represent, following these parameters:

assetId: {{assetId}}
time since buy: {{timeline}}
url: {{url}}

Guidelines:
- Write in natural sentences
- Keep it conversational and fluid
- Place url at the end
- Must not mention the {{assetId}}
- Maintain excitement without formal announcement structure
- Focus on acquiring/collecting rather than listing

Example format:
"someone just bought a music nft from an artist i represent on Tensor. Check it out: {{url}}"

Write the announcement without any additional commentary or meta-discussion. Generate only the announcement post itself.
Your response should not contain any questions. Brief, concise statements only. The total character count MUST be less than {{maxTweetLength}}. No emojis. Use \\n\\n (double spaces) between statements if there are multiple statements in your response.`;
