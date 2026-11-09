import {
  SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder,
  PermissionFlagsBits, InteractionContextType, MessageFlags,
} from 'discord.js';
import { ROLES, GROUPS } from './autoroles-config.js';

export const autorolesCommand = new SlashCommandBuilder()
  .setName('autoroles')
  .setDescription('Publica el panel de autoroles de Tokyo Ghoul')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .setContexts(InteractionContextType.Guild);

const findRole = (guild, def) => guild.roles.cache.find((r) => r.name === def.label);
const ensureRole = async (guild, def) =>
  findRole(guild, def) ?? guild.roles.create({ name: def.label, color: def.color, reason: 'Autoroles Tokyo Ghoul' });

// Devuelve true si la interacción era de autoroles (y ya fue atendida).
export async function handleAutoroles(i) {
  if (i.isChatInputCommand() && i.commandName === 'autoroles') {
    await i.deferReply({ flags: MessageFlags.Ephemeral });
    await i.guild.roles.fetch();
    for (const [g, info] of Object.entries(GROUPS)) {
      const roles = ROLES.filter((r) => r.group === g);
      for (const r of roles) await ensureRole(i.guild, r);
      const embed = new EmbedBuilder().setColor(0x8b0000).setTitle(info.title)
        .setDescription(roles.map((r) => `${r.emoji} **${r.label}**`).join('\n'))
        .setFooter({ text: info.exclusive ? 'Solo puedes tener uno' : 'Puedes tener varios' });
      const row = new ActionRowBuilder().addComponents(roles.map((r) =>
        new ButtonBuilder().setCustomId(`ar:${r.id}`).setLabel(r.label).setEmoji(r.emoji).setStyle(ButtonStyle.Secondary)));
      await i.channel.send({ embeds: [embed], components: [row] });
    }
    await i.editReply('Panel publicado.');
    return true;
  }
  if (i.isButton() && i.customId.startsWith('ar:')) {
    const def = ROLES.find((r) => r.id === i.customId.slice(3));
    if (!def || !i.guild) return true;
    await i.deferReply({ flags: MessageFlags.Ephemeral });
    try {
      await i.guild.roles.fetch();
      const role = await ensureRole(i.guild, def);
      if (i.member.roles.cache.has(role.id)) {
        await i.member.roles.remove(role);
        await i.editReply(`Rol **${def.label}** quitado.`);
        return true;
      }
      if (GROUPS[def.group].exclusive) {
        const others = ROLES.filter((r) => r.group === def.group && r.id !== def.id)
          .map((r) => findRole(i.guild, r)).filter((r) => r && i.member.roles.cache.has(r.id));
        if (others.length) await i.member.roles.remove(others);
      }
      await i.member.roles.add(role);
      await i.editReply(`Ahora eres **${def.label}** ${def.emoji}`);
    } catch (e) {
      console.error('[ Discord ] autoroles:', e);
      await i.editReply('No pude asignar el rol. El rol del bot debe estar por encima de los roles de Tokyo Ghoul y tener Manage Roles.');
    }
    return true;
  }
  return false;
}
