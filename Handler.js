const { Collection } = require('discord.js')
const fs = require('fs')
class Handler {
    constructor(Client, data = {}) {
        this.Client = Client
        if (!this.Client) return new Error('Client must not be empty')
        if (!data.directory) return new Error('Directory must not be empty')
        if (!data.prefixes) return new Error('Prefix must not be empty')
        if (!data.owners || data.owners.length < 1) {
            this.Client.owners = false
            console.log('Owner is empty, you will not be able to use owner commands.')
        } else {
            if (!Array.isArray(data.owners)) data.owners = [data.owners]
            this.Client.owners = data.owners
        }
        if (!Array.isArray(data.prefixes)) data.prefixes = [data.prefixes]
        if (data.disabled && !Array.isArray(data.disabled)) data.disabled = [data.disabled];
        else data.disabled = []
        this.Client.commands = new Collection()
        this.Client.aliases = new Collection()
        this.Client.prefixes = data.prefixes
        this.Client.disabled = data.disabled
        this.loadDefaultCommands(data.directory)
        this.loadDeveloperCommands()
        Client.on('message', this._message.bind(this))
    }

    async _message(msg) {
        if (msg.author.bot) return
        let prefix = false
        for (const Prefix of this.Client.prefixes) {
            if (msg.content.startsWith(Prefix)) prefix = Prefix
        }
        if (!msg.content.startsWith(prefix) || !prefix) return
        let args = msg.content.slice(prefix.length).trim().split(/ +/)
        let command = args.shift().toLowerCase()
        command = this.getCommand(command)
        if (command.error) return
        if (command.isOwner() && (!this.Client.owners || !this.Client.owners.includes(msg.author.id))) return msg.reply('You have no permission to use this!')
        if (command.isNSFW() && !msg.channel.nsfw) return msg.reply('This command is marked as NSFW, please use it in a NSFW channel.')
        try {
            command.run(msg, args, msg.client)
        } catch (err) {
            return msg.reply(`Oops, this shouldn't happen, please contact ${this.Client.owners.length < 1 ?
                'the bot owners' : this.Client.owners.map(o => !msg.client.users.get(o) ? o :
                    msg.client.users.get(o).tag).join(', or ')}. Here's the error\n\n\`${err.message}\``)
        }
    }

    getCommand(command) {
        if (!this.Client.commands.get(command)) command = this.Client.aliases.get(command)
        if (!command || (this.disabled && this.disabled.includes(command))) return { error: "Not a command" }
        return this.Client.commands.get(command)
    }

    loadDeveloperCommands() {
        for (const file of fs.readdirSync(__dirname + '/commands/')) {
            let command = require(__dirname + '/commands/' + file)
            command = new command()
            this.Client.commands.set(command.getName(), command)
            for (const alias of command.getAliases()) {
                this.Client.aliases.set(alias, command.getName())
            }
        }
    }

    loadDefaultCommands(directory) {
        let commands = fs.readdirSync(directory)
        commands.filter(f => fs.statSync(directory + f).isDirectory())
            .forEach(nestedDir => fs.readdirSync(directory + nestedDir)
            .forEach(f => commands.push(`${nestedDir}/${f}`)))
        commands = commands.filter(f => f.endsWith('.js'))

        for (const file of commands) {
            let command = require(directory + file)
            command = new command()
            this.Client.commands.set(command.getName(), command)
            for (const alias of command.getAliases()) {
                this.Client.aliases.set(alias, command.getName())
            }
        }
    }
}

module.exports = Handler