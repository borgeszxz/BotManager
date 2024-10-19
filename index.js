const { Client, GatewayIntentBits, PermissionsBitField, StringSelectMenuBuilder, TextInputStyle, Events, TextInputBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, InteractionType, ButtonStyle, Partials, ModalBuilder, AttachmentBuilder } = require('discord.js');
const axios = require('axios');
const crypto = require('crypto');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers
  ],
  partials: [Partials.Channel]
});

const token = 'SUA_TOKEN';

const accessTokens = new Map();

client.once('ready', async () => {
  console.log(`Bot logado como ${client.user.tag}`);
  
  client.user.setPresence({
    activities: [{ name: '⚒️ Developed by borgeszxz', type: 'WATCHING' }],
    status: 'online',
  });

  try {
    await client.application.commands.set([
      {
        name: 'setapi',
        description: 'Configura o Mercado Pago Access Token para este servidor',
        options: [
          {
            name: 'token',
            type: 3,
            description: 'Seu Mercado Pago Access Token',
            required: true,
          }
        ]
      },
      {
        name: 'ticket',
        description: 'Crie um ticket para suporte',
      },
      {
        name: 'mensagem',
        description: 'Envie uma mensagem para um canal específico',
      },
      {
        name: 'mudarnome',
        description: 'Mude o nome do seu canal',
        options: [
          {
            name: 'novo_nome',
            type: 3,
            description: 'Novo nome para o canal',
            required: true,
          }
        ]
      },
      {
        name: 'ban',
        description: 'Bane um membro do servidor',
        options: [
          {
            name: 'usuario',
            type: 6,
            description: 'Usuário a ser banido',
            required: true,
          },
          {
            name: 'motivo',
            type: 3,
            description: 'Motivo do banimento',
            required: false,
          }
        ]
      },
      {
        name: 'limpar',
        description: 'Limpe uma quantidade de mensagens',
        options: [
          {
            name: 'quantidade',
            type: 4,
            description: 'Número de mensagens para limpar',
            required: true,
          }
        ]
      },
      {
        name: 'gerarqr',
        description: 'Gera um QR code PIX para pagamento',
        options: [
          {
            name: 'valor',
            type: 4,
            description: 'Valor a ser pago',
            required: true,
          }
        ]
      }
    ]);
    console.log('Comandos slash recarregados com sucesso.');
  } catch (error) {
    console.error('Erro ao recarregar comandos slash:', error);
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isCommand()) {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({ content: 'Você precisa ser um administrador para usar este comando.', ephemeral: true });
    }

    if (interaction.commandName === 'setapi') {
      const token = interaction.options.getString('token');
      accessTokens.set(interaction.guild.id, token);
      await interaction.reply({ content: 'Access Token configurado com sucesso para este servidor!', ephemeral: true });
    }

    if (interaction.commandName === 'gerarqr') {
      const guildId = interaction.guild.id;
      const mercadoPagoAccessToken = accessTokens.get(guildId);

      if (!mercadoPagoAccessToken) {
        return interaction.reply({ content: 'Você precisa configurar o Access Token do Mercado Pago primeiro usando o comando `/setapi`.', ephemeral: true });
      }

      const valor = interaction.options.getInteger('valor');
      const idempotencyKey = crypto.randomBytes(16).toString('hex');

      try {
        const response = await axios.post('https://api.mercadopago.com/v1/payments', {
          transaction_amount: valor,
          payment_method_id: 'pix',
          description: 'Pagamento Discord Bot',
          payer: {
            email: 'email@example.com'
          }
        }, {
          headers: {
            'Authorization': `Bearer ${mercadoPagoAccessToken}`,
            'X-Idempotency-Key': idempotencyKey
          }
        });

        const qrCodeUrl = response.data.point_of_interaction.transaction_data.qr_code_base64;
        const qrCodeBuffer = Buffer.from(qrCodeUrl, 'base64');
        const transactionId = response.data.id;

        const attachment = new AttachmentBuilder(qrCodeBuffer, { name: 'qrcode.png' });
        const embed = new EmbedBuilder()
          .setColor('#00FF00')
          .setTitle('QR Code para Pagamento PIX')
          .setDescription(`Escaneie o QR Code abaixo para realizar o pagamento de R$${valor}`)
          .setImage('attachment://qrcode.png')
          .setFooter({ text: 'Pagamento via Mercado Pago' });

        const message = await interaction.reply({ embeds: [embed], files: [attachment], fetchReply: true });

        setTimeout(() => verificarPagamento(transactionId, interaction.channelId, message.id, valor, mercadoPagoAccessToken), 30000);

      } catch (error) {
        console.error('Erro ao gerar o QR code:', error);
        await interaction.reply({ content: 'Houve um erro ao gerar o QR code. Por favor, tente novamente mais tarde.', ephemeral: true });
      }
    }

    if (interaction.commandName === 'ticket') {
      const modal = new ModalBuilder()
        .setCustomId('modal_ticket')
        .setTitle('Criar Ticket');

      const colorInput = new TextInputBuilder()
        .setCustomId('color')
        .setLabel('Cor do embed em hexadecimal')
        .setRequired(true)
        .setStyle(TextInputStyle.Short);

      const messageInput = new TextInputBuilder()
        .setCustomId('message')
        .setLabel('Mensagem')
        .setRequired(true)
        .setStyle(TextInputStyle.Paragraph);

      const channelInput = new TextInputBuilder()
        .setCustomId('channel')
        .setLabel('ID do canal')
        .setRequired(true)
        .setStyle(TextInputStyle.Short);

      modal.addComponents(
        new ActionRowBuilder().addComponents(colorInput),
        new ActionRowBuilder().addComponents(messageInput),
        new ActionRowBuilder().addComponents(channelInput)
      );

      await interaction.showModal(modal);
    }

    if (interaction.commandName === 'mudarnome') {
      const newName = interaction.options.getString('novo_nome');
      if (interaction.channel.type === 0) {
        await interaction.channel.setName(newName);
        await interaction.reply({ content: `Nome do canal alterado para ${newName}`, ephemeral: true });
      } else {
        await interaction.reply({ content: 'Este comando só pode ser usado em canais de texto.', ephemeral: true });
      }
    }

    if (interaction.commandName === 'mensagem') {
      try {
        const modal = new ModalBuilder()
          .setCustomId('modal_mensagem')
          .setTitle('Enviar Mensagem');

        const colorInput = new TextInputBuilder()
          .setCustomId('color')
          .setLabel('Cor do embed em hexadecimal')
          .setRequired(true)
          .setStyle(TextInputStyle.Short);

        const messageInput = new TextInputBuilder()
          .setCustomId('message')
          .setLabel('Mensagem')
          .setRequired(true)
          .setStyle(TextInputStyle.Paragraph);

        const channelInput = new TextInputBuilder()
          .setCustomId('channel')
          .setLabel('ID do canal')
          .setRequired(true)
          .setStyle(TextInputStyle.Short);

        const mediaInput = new TextInputBuilder()
          .setCustomId('media')
          .setLabel('Link da imagem ou vídeo')
          .setRequired(false)
          .setStyle(TextInputStyle.Short);

        modal.addComponents(
          new ActionRowBuilder().addComponents(colorInput),
          new ActionRowBuilder().addComponents(messageInput),
          new ActionRowBuilder().addComponents(channelInput),
          new ActionRowBuilder().addComponents(mediaInput)
        );

        await interaction.showModal(modal);
      } catch (error) {
        console.error('Erro ao executar o comando /mensagem:', error);

        try {
          await interaction.reply({ content: 'Houve um erro ao tentar exibir o modal.', ephemeral: true });
        } catch (replyError) {
          console.error('Erro ao enviar a resposta de erro:', replyError);
        }
      }
    }

    if (interaction.commandName === 'ban') {
      const user = interaction.options.getUser('usuario');
      const reason = interaction.options.getString('motivo') || 'Sem motivo especificado';

      if (user) {
        const member = interaction.guild.members.cache.get(user.id);

        if (!member) {
          return interaction.reply({ content: 'O usuário não foi encontrado neste servidor.', ephemeral: true });
        }

        if (!interaction.guild.members.me.permissions.has(PermissionsBitField.Flags.BanMembers)) {
          return interaction.reply({ content: 'Eu preciso de permissões de Administrador para banir membros.', ephemeral: true });
        }

        try {
          await member.ban({ reason });
          await interaction.reply({ content: `Usuário ${user.tag} banido por ${reason}`, ephemeral: true });
        } catch (error) {
          if (error.code === 50013) {
            await interaction.reply({ content: 'Não tenho permissões suficientes para banir este usuário.', ephemeral: true });
          } else {
            console.error('Erro ao banir o usuário:', error);
            await interaction.reply({ content: 'Houve um erro ao tentar banir o usuário.', ephemeral: true });
          }
        }
      } else {
        await interaction.reply({ content: 'Usuário não encontrado.', ephemeral: true });
      }
    }

    if (interaction.commandName === 'limpar') {
      const amount = interaction.options.getInteger('quantidade');

      if (amount) {
        const fetched = await interaction.channel.messages.fetch({ limit: amount + 1 });
        await interaction.channel.bulkDelete(fetched);
        await interaction.reply({ content: `Foram removidas ${amount} mensagens.`, ephemeral: true });
      } else {
        await interaction.reply({ content: 'Quantidade inválida.', ephemeral: true });
      }
    }
  }

  if (interaction.isModalSubmit()) {
    // Tratamento de Modal
    if (interaction.customId === 'modal_ticket') {
      const color = interaction.fields.getTextInputValue('color');
      const message = interaction.fields.getTextInputValue('message');
      const channelId = interaction.fields.getTextInputValue('channel');
      const channel = client.channels.cache.get(channelId);

      if (!channel || channel.type !== 0 || channel.guild.id !== interaction.guild.id) {
        return interaction.reply({ content: 'Canal inválido.', ephemeral: true });
      }

      const embed = new EmbedBuilder()
        .setColor(color)
        .setDescription(message)
        .setFooter({ text: `${interaction.guild.name} - © All rights reserved.` });

      const selectMenu = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('select_ticket')
          .setPlaceholder('Selecione uma opção')
          .addOptions([
            {
              label: '📞 | Suporte',
              value: 'suporte',
            },
            {
              label: '💸 | Comprar',
              value: 'comprar',
            },
          ]),
      );

      await channel.send({ embeds: [embed], components: [selectMenu] });

      await interaction.reply({ content: 'Ticket configurado com sucesso!', ephemeral: true });
    }

    if (interaction.customId === 'modal_mensagem') {
      const color = interaction.fields.getTextInputValue('color');
      const message = interaction.fields.getTextInputValue('message');
      const channelId = interaction.fields.getTextInputValue('channel');
      const mediaLink = interaction.fields.getTextInputValue('media');
      const channel = client.channels.cache.get(channelId);

      if (!channel || channel.type !== 0 || channel.guild.id !== interaction.guild.id) {
        return interaction.reply({ content: 'Canal inválido ou não pertence ao servidor atual.', ephemeral: true });
      }

      const embed = new EmbedBuilder()
        .setColor(color)
        .setDescription(message)
        .setFooter({ text: `${interaction.guild.name} - © All rights reserved.` });

      if (mediaLink) {
        embed.setImage(mediaLink);
      }

      await channel.send({ embeds: [embed] });

      await interaction.reply({ content: 'Mensagem enviada com sucesso!', ephemeral: true });
    }
  }

  if (interaction.isStringSelectMenu()) {
    if (interaction.customId === 'select_ticket') {
      const guild = interaction.guild;
      const member = interaction.member;
      const selectedOption = interaction.values[0];

      let ticketName = '';
      if (selectedOption === 'suporte') {
        ticketName = `📞・${member.user.username}`;
      } else if (selectedOption === 'comprar') {
        ticketName = `💸・${member.user.username}`;
      }

      const ticketChannel = await guild.channels.create({
        name: ticketName,
        type: 0,
        permissionOverwrites: [
          {
            id: guild.id,
            deny: [PermissionsBitField.Flags.ViewChannel],
          },
          {
            id: member.id,
            allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages],
          },
          {
            id: guild.roles.cache.find(role => role.permissions.has(PermissionsBitField.Flags.Administrator))?.id || guild.id,
            allow: [PermissionsBitField.Flags.ViewChannel],
          },
        ],
      });

      const embed = new EmbedBuilder()
        .setColor('#00FF00')
        .setDescription(`**TICKET SYSTEM**\n<@${member.id}>, Seu 🎫 ticket foi criado com sucesso! Aguarde por um administrador.`)
        .setFooter({ text: 'Ticket criado.' });

      const closeButton = new ButtonBuilder()
        .setCustomId('close_ticket')
        .setLabel('🔒 Fechar ticket')
        .setStyle(ButtonStyle.Danger);

      await ticketChannel.send({
        embeds: [embed],
        components: [new ActionRowBuilder().addComponents(closeButton)],
      });

      await interaction.reply({ content: 'Seu ticket foi criado com sucesso!', ephemeral: true });
    }
  }

  if (interaction.isButton()) {
    if (interaction.customId === 'close_ticket') {
      if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return interaction.reply({ content: 'Você não tem permissão para fechar este ticket.', ephemeral: true });
      }

      const channel = interaction.channel;

      await interaction.reply({ content: 'Fechando o ticket...', ephemeral: true });

      const closeEmbed = new EmbedBuilder()
        .setColor('#FF0000')
        .setDescription('Este ticket foi fechado. Caso precise de mais assistência, crie um novo ticket.');

      await channel.send({ embeds: [closeEmbed] });

      setTimeout(async () => {
        await channel.delete();
      }, 5000);
    }
  }
});

async function verificarPagamento(transactionId, channelId, messageId, valor, mercadoPagoAccessToken) {
  try {
    const response = await axios.get(`https://api.mercadopago.com/v1/payments/${transactionId}`, {
      headers: {
        'Authorization': `Bearer ${mercadoPagoAccessToken}`
      }
    });

    const payment = response.data;

    if (payment.status === 'approved') {
      const channel = client.channels.cache.get(channelId);
      if (channel) {
        const message = await channel.messages.fetch(messageId);
        if (message) {
          await message.delete();

          const embed = new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle('✅ Pagamento Aprovado')
            .setDescription(`O pagamento no valor de **R$${valor}** foi aprovado com sucesso!`)
            .setFooter({ text: 'Obrigado pelo seu pagamento!' });

          await channel.send({ embeds: [embed] });
        }
      }
    } else if (payment.status === 'pending') {
      setTimeout(() => verificarPagamento(transactionId, channelId, messageId, valor, mercadoPagoAccessToken), 30000);
    }
  } catch (error) {
    console.error('Erro ao verificar status do pagamento:', error);
  }
}

client.login(token);
