# tail-fweb
`tail -f` but to stream a file as it changes to a browser instead of using terminal. 
## Installation  
Installs globally as a command so that it can be run from anywhere on the machine.
`npm install -g tail-fweb`
## Usage 
`tail-fweb -p 3000 -f file.log` 
Opens `file.log` in tail mode and hosts a web server on [http://localhost:3000/tail-f ](http://localhost:3000/tail-f)
