import type { CustomerHistoryPayload } from './tools';

export interface AnalysisResult {
  isAppropriate: boolean;
  recommendation: string;
  evidence: string[];
  suggestedFocus: string;
  source: 'ai' | 'rule_based_fallback';
  modelUsed?: string;
}

export interface DraftResult {
  subject: string;
  body: string;
  source: 'ai' | 'rule_based_fallback';
  modelUsed?: string;
}

const GROQ_MODEL = 'openai/gpt-oss-120b';

/**
 * Call Groq chat completion API with strict timeout & error handling
 */
async function callGroqChat(messages: { role: 'system' | 'user' | 'assistant'; content: string }[], temperature = 0.2) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || apiKey.trim() === '' || apiKey.includes('your-groq')) {
    throw new Error('GROQ_API_KEY is not configured in server environment.');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey.trim()}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages,
        temperature,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Groq API returned error ${res.status}: ${errText}`);
    }

    const data = await res.json();
    let content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('Empty response from Groq API');
    }

    // Strip markdown code fences if model wrapped the JSON
    content = content.trim();
    if (content.startsWith('```json')) {
      content = content.slice(7);
    } else if (content.startsWith('```')) {
      content = content.slice(3);
    }
    if (content.endsWith('```')) {
      content = content.slice(0, -3);
    }

    return JSON.parse(content.trim());
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

/**
 * AI / Rule-based Customer Follow-Up Analysis
 */
export async function analyzeCustomerWithAI(history: CustomerHistoryPayload): Promise<AnalysisResult> {
  const { customer, orderCount, completedOrdersCount, totalCompletedSpend, daysSinceLastCompletedOrder, recentOrders } = history;

  const recentPurchases = recentOrders
    .map(
      (o) =>
        `- Order ${o.order_number} (${o.status}): ₹${o.total} on ${new Date(o.ordered_at).toISOString().split('T')[0]}. Items: ${
          o.items?.map((i) => i.product_name).join(', ') || 'No items listed'
        }`
    )
    .slice(0, 5)
    .join('\n');

  try {
    const prompt = `You are CommercePilot AI, an expert CRM customer retention agent.
Evaluate this customer's purchase history and determine if a re-engagement follow-up is appropriate.

Authoritative Customer Data:
- Name: ${customer.first_name} ${customer.last_name}
- Email: ${customer.email}
- Tags: ${(customer.tags || []).join(', ') || 'none'}
- Total Orders: ${orderCount} (Completed: ${completedOrdersCount})
- Total Spend on Completed Orders: ₹${totalCompletedSpend}
- Days Since Last Completed Order: ${daysSinceLastCompletedOrder ?? 'No completed orders'}
- Recent Orders:
${recentPurchases || 'None'}

Return a JSON object with:
{
  "isAppropriate": boolean,
  "recommendation": string,
  "evidence": string[],
  "suggestedFocus": string
}`;

    const parsed = await callGroqChat([
      { role: 'system', content: 'You are an analytical CRM retention agent. Respond ONLY with a valid JSON object matching the requested schema.' },
      { role: 'user', content: prompt },
    ]);

    return {
      isAppropriate: Boolean(parsed.isAppropriate ?? true),
      recommendation: parsed.recommendation || 'Customer is eligible for win-back re-engagement.',
      evidence: Array.isArray(parsed.evidence)
        ? parsed.evidence
        : [`Last active ${daysSinceLastCompletedOrder} days ago`, `Completed spend of ₹${totalCompletedSpend}`],
      suggestedFocus: parsed.suggestedFocus || 'Check-in on previous equipment satisfaction and new arrivals.',
      source: 'ai',
      modelUsed: GROQ_MODEL,
    };
  } catch (err: unknown) {
    console.warn('[AI Service] Groq LLM call failed, using rule-based fallback:', err instanceof Error ? err.message : err);
    return getRuleBasedAnalysis(history);
  }
}

/**
 * Deterministic Rule-Based Fallback Analysis
 */
function getRuleBasedAnalysis(history: CustomerHistoryPayload): AnalysisResult {
  const { customer, completedOrdersCount, totalCompletedSpend, daysSinceLastCompletedOrder, recentOrders } = history;
  const isInactive = (daysSinceLastCompletedOrder ?? 0) >= 60;
  const isHighValue = totalCompletedSpend >= 30000;
  const latestOrder = recentOrders[0];
  const sampleProduct = latestOrder?.items?.[0]?.product_name || 'store supplies';

  const evidence: string[] = [
    `Customer last completed an order ${daysSinceLastCompletedOrder ?? 'N/A'} days ago.`,
    `Total completed orders on record: ${completedOrdersCount} orders.`,
    `Total lifetime value: ₹${totalCompletedSpend.toLocaleString('en-IN')}.`,
  ];

  if (latestOrder) {
    evidence.push(`Most recent order ${latestOrder.order_number} included: ${sampleProduct}.`);
  }

  let recommendation = '';
  if (isHighValue && isInactive) {
    recommendation = `${customer.first_name} is a high-value repeat customer who hasn't purchased in over 2 months. Reach out with a VIP satisfaction check and personalized discount on complementary products.`;
  } else if (isInactive) {
    recommendation = `${customer.first_name} has completed ${completedOrdersCount} previous order(s) but has become inactive over the past ${daysSinceLastCompletedOrder} days. A friendly re-engagement check-in is recommended.`;
  } else {
    recommendation = `${customer.first_name} was recently active. Standard follow-up or routine satisfaction check is optional.`;
  }

  return {
    isAppropriate: isInactive && completedOrdersCount > 0,
    recommendation,
    evidence,
    suggestedFocus: `Follow up regarding experience with ${sampleProduct} and offer assistance.`,
    source: 'rule_based_fallback',
  };
}

/**
 * AI / Rule-based Email Draft Generator
 */
export async function generateEmailDraftWithAI(
  history: CustomerHistoryPayload,
  recommendationReason: string
): Promise<DraftResult> {
  const { customer, daysSinceLastCompletedOrder, recentOrders, totalCompletedSpend } = history;
  const lastOrder = recentOrders[0];
  const productName = lastOrder?.items?.[0]?.product_name || 'your previous order';

  try {
    const prompt = `You are an AI retention specialist for an electrical/solar equipment store (CommercePilot / Kilowatt CRM).
Generate a personalized, warm, professional follow-up email for this customer.

Customer: ${customer.first_name} ${customer.last_name}
Email: ${customer.email}
Days Inactive: ${daysSinceLastCompletedOrder ?? 60}
Last Order Ref: ${lastOrder?.order_number || 'previous purchase'}
Last Product Purchased: ${productName}
Total Spend: ₹${totalCompletedSpend}
Recommendation Reason: ${recommendationReason}

Requirements:
1. Warm, professional, helpful tone. NOT spammy.
2. Specifically reference their past purchase (${productName}) and ask how it is performing.
3. Offer assistance or share that complementary accessories/upgrades are available.
4. Sign off as "The Support & Customer Care Team, Kilowatt CommercePilot".

Return a JSON object:
{
  "subject": string,
  "body": string
}`;

    const parsed = await callGroqChat([
      { role: 'system', content: 'You are an expert copywriter. Respond ONLY with valid JSON.' },
      { role: 'user', content: prompt },
    ]);

    if (!parsed.subject || !parsed.body) {
      throw new Error('Malformed draft response from LLM');
    }

    return {
      subject: parsed.subject,
      body: parsed.body,
      source: 'ai',
      modelUsed: GROQ_MODEL,
    };
  } catch (err: unknown) {
    console.warn('[AI Service] Groq LLM unavailable for draft, using rule-based fallback:', err instanceof Error ? err.message : err);
    return getRuleBasedDraft(history);
  }
}

/**
 * Deterministic Rule-Based Draft Fallback
 */
function getRuleBasedDraft(history: CustomerHistoryPayload): DraftResult {
  const { customer, recentOrders } = history;
  const lastOrder = recentOrders[0];
  const productName = lastOrder?.items?.[0]?.product_name || 'recent equipment';

  const subject = `Checking in on your ${productName} — How is everything running?`;
  const body = `Hi ${customer.first_name},

We hope you're having a great week!

It has been a few months since your order (${lastOrder?.order_number || 'with us'}), and we wanted to check in to see how your ${productName} is performing.

At Kilowatt Store, your satisfaction and equipment reliability are our top priorities. If you need any assistance, maintenance tips, or complementary accessories for your setup, our support team is always here to help.

As a valued customer, feel free to reply directly to this email or visit our store whenever you're ready for your next project.

Warm regards,

Customer Care Team
Kilowatt CommercePilot
`;

  return {
    subject,
    body,
    source: 'rule_based_fallback',
  };
}
