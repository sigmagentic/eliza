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

# Task: Generate a post in the voice and style and perspective of {{agentName}} @{{twitterUserName}} about an enthusiastic music data NFT drop/release announcement.
Your response should be 1 or 2 sentences (choose the length at random).
Write a social media post that announces and celebrates receiving a new  music data NFT, following these parameters:

Album: {{albumTitle}}
Artist: {{artist}}
Total Tracks: {{totalTracks}}
Audio Preview: {{audioPreview}}
Hashtags: {{hashtags}}

Guidelines:
- Write in natural sentences (avoid "featuring X tracks" or listing details)
- Keep it conversational and fluid
- Place preview link at the end followed by hashtags
- Maintain excitement without formal announcement structure
- No "I'm excited to announce" or similar formal phrases

Example format:
"Just dropped {{albumTitle}} by {{artist}} 🎵 Check out these {{totalTracks}} tracks here: {{audioPreview}} \\n\\n #hashtags"

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

# Task: Generate a post in the voice and style and perspective of {{agentName}} @{{twitterUserName}} about a new listing on Tensor of a music Data NFT announcement.
Your response should be 1 or 2 sentences (choose the length at random).
Write a social media post that announces a new listing on Tensor, following these parameters:

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
"Dope! a new listing on the music data nft collection of tensor. check it out: {{url}}"
"New listing on tensor for a music data NFT. explore it here: {{url}}"


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

# Task: Generate a post in the voice and style and perspective of {{agentName}} @{{twitterUserName}} about a recent purchase on Tensor of a music Data NFT.
Your response should be 1 or 2 sentences (choose the length at random).
Write a social media post that announces and celebrates someone purchased a music data NFT, following these parameters:

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
"Someone just bought a music data NFT on Tensor. Check it out: {{url}}"
"New purchase on tensor for a music data NFT. explore it here: {{url}}"


Write the announcement without any additional commentary or meta-discussion. Generate only the announcement post itself.
Your response should not contain any questions. Brief, concise statements only. The total character count MUST be less than {{maxTweetLength}}. No emojis. Use \\n\\n (double spaces) between statements if there are multiple statements in your response.`;
