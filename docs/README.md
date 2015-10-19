Cows and bulls

Game implementation using web sockets to provide real-time multiplayer


The messages between the server and the clients are in JSON format, using the convention:
On success - returns a dictionary with "result":0 with additional fields depending on the call.
On failute - returns a dictionary with "result":"error code" and "message":"Error message".

A main goal was to provide the most simple method as possible.
For this reason, the players register by "name" and then a unique "playerid" is returned. Then the player is authenticated by this ID number.


The service uses two methods for client-server communication.

REST API
This are the methods, that are related to player not being in a started game.

- register - registers a new user.
  Expects "name" and returns "playerid"

- create - create a new game. The game type is set by the "type" parameter. The types are:
    * 0 - training - single player without a bot
    * 1 - single player - against AI
    * 2 - token ring - multiplayer, where the players have to guess server's number
    * 3 - peer2peer - multiplayer, type human vs human.

   Additional parameters are "max_players" and "name".


- addterminal - add AI to a not started 'token ring' game. Expects "gameid".

- kick - remove a user from a game, which is not started. Expects "gameid"
       Additionally, "kicked" player could be identified, otherwise the current player is kicked.

- start - start a game. Only the creator of the game can do this action.
       Expects "gameid".




Websocket API
Those are methods, which are related to the playing of a current game.
A picture sockets.png is applied to show how the communication trough the game is done.

All socket methods require "playerid" authentication.

Methods:

- join - open a websocket for a game, which is identifeid by "gameid".

- acknowledge - send ACK message, that the player will take a part of the current turn.

- guess - send guess in a current game turn. The 'number' parameter is the player's guees.

Events:

- new_player - send information that a player joined the game. Contains player metadata object.

- leave_player - send information that a player left the game. Contains player metadata object.

- start - send information that the game was started.

- set_number - notifies the player what 'number' was assigned to him for the game.

- turn - notify about a player's turn. Contains player metadata object, 'mine' if the move is for the current player and 'guessing' - the start and end point of the turn. On all sockets ACK should be send, otherwise the game will terminate.

- guess - send information about a valid guess that a player made in the game. Contains guess metadata information.

- invalid_guess - tells that the player entered invalid number.

- win - notifies that the game has a winner. Has the field 'mine' to notify if the player, won the game, and additional 'number', if the player lost by his opponent.

- timeout - notify that a timeout was detected.

- terminate - notify that the game was terminated.



Core logic

In its core, the game has an interval, which checks for received commnads.
The game has two states:
    - ACK - awaiting for turn acknowledges from the players. If not all received, the game is terminated. This is to provide that all players are listening on the sockets.
    - GUESS - await for the player's turn

The game registers players, which should send commands to the game.
Then the game notifies the players for the following events:
    * new_player
    * leave_player
    * start
    * guess
    * turn
    * timeout
    * set_number
    * invalid_guess
    * terminate

The sockets, AI and console application are examples how to integrate this interface to the game.











