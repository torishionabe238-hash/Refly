import Anthropic from 'npm:@anthropic-ai/sdk'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const { episode_text } = await req.json()

  if (!episode_text || episode_text.trim().length === 0) {
    return new Response(
      JSON.stringify({ error: 'エピソードの内容がありません' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const client = new Anthropic()

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `以下のエピソードトークを「つかみ・本題・オチ」の3パート構成に整理してください。
話し言葉のまま、実際に声に出して話せる形にしてください。

## 出力形式（必ずこの形式で）
**つかみ：**
（聞き手の興味を引く最初の一言。「実はさ〜」「信じられないんだけど」など、続きが聞きたくなる導入。1〜2文）

**本題：**
（何が起きたかを順序立てて。具体的なエピソードの核心部分。話し言葉で自然に）

**オチ：**
（笑い・共感・驚きで締める一言。余韻が残る結末）

## エピソード
${episode_text}`,
      },
    ],
  })

  const raw = message.content[0].type === 'text' ? message.content[0].text : ''

  const tsukamni = raw.match(/\*\*つかみ[：:]\*\*\s*([\s\S]*?)(?=\*\*本題|$)/)?.[1]?.trim() ?? ''
  const hondai   = raw.match(/\*\*本題[：:]\*\*\s*([\s\S]*?)(?=\*\*オチ|$)/)?.[1]?.trim() ?? ''
  const ochi     = raw.match(/\*\*オチ[：:]\*\*\s*([\s\S]*)$/)?.[1]?.trim() ?? ''

  return new Response(
    JSON.stringify({ tsukamni, hondai, ochi }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
})
