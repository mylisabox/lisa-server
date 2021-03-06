/**
 * Stores Configuration
 * (app.config.stores)
 *
 * Configure the ORM layers, connections, etc.
 *
 * @see {@link http://fabrix.app/doc/config/database}
 */
/**
 * Define the database stores. A store is typically a single database.
 *
 * Set production connection info in config/env/production/store.ts
 */
export const stores = {
    /**
     * Define a store called "dev" which uses Sequelize and SQLite3 to persist data.
     */
    sqlite: {
        orm: 'sequelize',
        database: 'lisa',
        storage: './lisa.sqlite',
        host: '127.0.0.1',
        dialect: 'sqlite',
        //logging: process.env.LOGGER ? false : logger.debug,
        define: {
            hooks: {
                afterCreate: (instance, options, fn) => {
                    const app = instance.sequelize.trailsApp
                    const modelName = instance.Model.name.toLowerCase()
                    //For notification we send event only to user room not globally
                    if (modelName === 'notification') {
                        app.services.NotificationService.sendWebNotification(instance)
                    } else {
                        if (app.sockets.room) {
                            app.sockets.room(modelName).send('create', modelName, instance)
                        }
                    }
                    if (modelName === 'device' || modelName === 'room' || modelName.toLowerCase() === 'chatbotparamlist') {
                        app.services.ChatBotService.reloadBots().then(() => fn()).catch(err => fn())
                    } else {
                        fn()
                    }
                },
                afterUpdate: (instance, options, fn) => {
                    const app = instance.sequelize.trailsApp
                    const modelName = instance.Model.name.toLowerCase()
                    app.sockets.room(modelName).send('update', modelName, instance)

                    if (modelName === 'room' || modelName === 'chatbotparamlist') {
                        app.services.ChatBotService.reloadBots().then(() => fn()).catch(err => {
                            app.log.error(err)
                            fn()
                        })
                    } else {
                        fn()
                    }
                },
                afterBulkUpdate: (instance, fn) => {
                    if (!instance.attributes.id) return fn()

                    const app = instance.model.sequelize.trailsApp
                    const modelName = instance.model.name.toLowerCase()

                    if (modelName === 'room' || modelName.toLowerCase() === 'chatbotparamlist') {
                        app.services.ChatBotService.reloadBots().then(() => {
                        }).catch(err => {
                            app.log.error(err)
                        })
                    }

                    instance.model.findAll({where: instance.where}).then(models => {
                        if (modelName === 'device') {
                            instance.model.findAll({where: {roomID: models[0].roomId}}).then(devices => {
                                const group = app.services.DashboardService.getAdditionalGroupDevice(models[0].roomId, devices, models[0].type)
                                for (const m of group) {
                                    app.sockets.room(modelName).send('update', modelName, m)
                                }
                            }).catch(err => app.log.error(err))
                        }

                        for (const m of models) {
                            app.sockets.room(modelName).send('update', modelName, m)
                        }
                        fn()
                    })
                },
                afterDestroy: (instance, options, fn) => {
                    const app = instance.sequelize.trailsApp
                    const modelName = instance.Model.name.toLowerCase()

                    if (modelName === 'device' || modelName === 'room' || modelName.toLowerCase() === 'chatbotparamlist') {
                        app.services.ChatBotService.reloadBots().then(() => {
                        }).catch(err => {
                            app.log.error(err)
                        })
                    }
                    app.sockets.room(modelName).send('destroy', modelName, instance)
                    fn()
                },
                afterBulkDestroy: (instance, fn) => {
                    if (!instance.where.id) return fn()

                    const app = instance.model.sequelize.trailsApp
                    const modelName = instance.model.name.toLowerCase()

                    if (modelName === 'device' || modelName === 'room' || modelName.toLowerCase() === 'chatbotparamlist') {
                        app.services.ChatBotService.reloadBots().then(() => {
                        }).catch(err => {
                            app.log.error(err)
                        })
                    }

                    app.sockets.room(modelName).send('destroy', modelName, instance.where.id)

                    fn()
                },
            }
        }
    }
}
