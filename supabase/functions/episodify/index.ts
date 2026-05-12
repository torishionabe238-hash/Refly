import Anthropic from 'npm:@anthropic-ai/sdk'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const { content } = await req.json()

  if (!content || content.trim().length === 0) {
    return new Response(
      JSON.stringify({ error: '日記の内容がありません' }),
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
        content: `以下の日記を、友人との会話で使えるエピソードトークに変換してください。

## 条件
- 話し言葉で、自然に話せる形にする
- 「起承転結」を意識した構成にする
- オチや印象的なポイントを明確にする
- 話す時間の目安は1〜2分程度（200〜300文字）
- 聞いている人が「面白い」「共感できる」と感じる表現を使う

## 出力形式
**エピソードトーク：**
（話し言葉のエピソード本文）

**話すときのポイント：**
・（ポイント1）
・（ポイント2）
・（ポイント3）

## 日記
${content}`,
      },
    ],
  })

  const result = message.content[0].type === 'text' ? message.content[0].text : ''

  return new Response(
    JSON.stringify({ episode: result }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
})
