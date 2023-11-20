# Gromozeka Bot

[![Docker Image](https://img.shields.io/docker/v/enginerd/gromozeka?label=dockerhub&logo=docker&sort=semver)](https://hub.docker.com/r/enginerd/gromozeka)

> :warning: **Attention!** The development and support of Gromozeka Bot have been suspended due to Telegram's improved ability to track user session creation through bots. A few months ago, there were minimal issues with creating user sessions, except for the verification code during login, which couldn't be sent through the bot as is. However, users were able to work around this restriction by adding whitespace between digits or encrypting the verification code with base64, decrypting it on the bot's side. Unfortunately, Telegram now tracks session creation through bots, even during the initial phone number entry stage. I'm uncertain about the specifics of how this tracking works, but I cannot risk the deactivation of my accounts. While I won't delete the bot code, I won't be actively developing it either. At this point, Gromozeka bot merely serves as an example of how [TeleBuilder](https://github.com/en9inerd/telebuilder) can be utilized.  
If you need to delete all messages from a chat, channel, or conversation, you can use the [TgEraser](https://pypi.org/project/tgeraser/) command-line tool, which is both safe and easy to use.

## What is Gromozeka Bot?

Gromozeka Bot was implemented to assist the user in deleting all of their messages from a Telegram chat, channel, or conversation, even without admin privileges. Official Telegram clients do not offer a one-click solution to delete all messages from a chat; the user must manually select the messages they wish to delete, and they can only delete up to 100 selected messages at a time.  
Gromozeka Bot was created to address this problem.
