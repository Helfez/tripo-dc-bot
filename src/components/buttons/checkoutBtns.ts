import {ActionRowBuilder, ButtonBuilder, ButtonStyle} from "discord.js";

const STORE_DOMAIN = "https://jujubit.ai";

interface VariantOption {
  label: string;
  variantId: string;
  emoji?: string;
}

const VARIANTS: VariantOption[] = [
  { label: '4cm $29.99',  variantId: '62418107728243',  emoji: '🔹' },
  { label: '5cm $49.99',  variantId: '62418108809587',  emoji: '🔹' },
  { label: '6cm $59.99',  variantId: '62485711716723',  emoji: '⭐' },
  { label: '7cm $89.99',  variantId: '62485711749491',  emoji: '🔸' },
  { label: '8cm $109.99', variantId: '62485711782259',  emoji: '🔸' },
  { label: '10cm $129.99', variantId: '62485711815027', emoji: '💎' },
];

export interface CheckoutInfo {
  styleName?: string;
  designUrl?: string;
}

function makeCheckoutUrl(variantId: string, info?: CheckoutInfo): string {
  const base = `${STORE_DOMAIN}/cart/${variantId}:1`;
  if (!info?.designUrl && !info?.styleName) return base;

  const note = [
    info.styleName ? `Style: ${info.styleName}` : '',
    info.designUrl ? `Design: ${info.designUrl}` : '',
  ].filter(Boolean).join(' | ');

  return `${base}?note=${encodeURIComponent(note)}`;
}

export function CheckoutBtnRows(info?: CheckoutInfo): ActionRowBuilder<ButtonBuilder>[] {
  const row1 = new ActionRowBuilder<ButtonBuilder>();
  const row2 = new ActionRowBuilder<ButtonBuilder>();

  for (let i = 0; i < VARIANTS.length; i++) {
    const v = VARIANTS[i];
    const btn = new ButtonBuilder()
      .setLabel(v.label)
      .setStyle(ButtonStyle.Link)
      .setURL(makeCheckoutUrl(v.variantId, info));
    if (v.emoji) btn.setEmoji(v.emoji);

    if (i < 3) {
      row1.addComponents(btn);
    } else {
      row2.addComponents(btn);
    }
  }

  return [row1, row2];
}
