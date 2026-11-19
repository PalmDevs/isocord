/** First letter of each word, as the reference client abbreviates servers without an icon. */
export const guildAcronym = (name: string) =>
    name
        .replace(/'s /g, ' ')
        .replace(/\w+/g, word => word[0] ?? '')
        .replace(/\s/g, '')
        .slice(0, 4)
