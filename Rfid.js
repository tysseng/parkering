// https://github.com/RussTheAerialist/node-spi
//SPI1_Init_Advanced(_SPI_MASTER_OSC_DIV16, _SPI_DATA_SAMPLE_MIDDLE, _SPI_CLK_IDLE_LOW, _SPI_LOW_2_HIGH);
var gpio = require('rpi-gpio');

var config = {
  spi: {
    mockSpi: true,
    slaveReadEnabled: true,
    loopback: false,
    device: '/dev/spidev0.0',
    mode: 'MODE_1',     // clock idle low, clock phase active to idle.
    chipSelect: 'none', // 'none', 'high' - defaults to low
    //100k works fine
    //200k seems to work too
    //250k makes pic32 fail at times
    //1000000 fails all the time
    maxSpeed: 200000,
    interruptPin: 22,
    minBufferSize: 16
  }
}

// CR95HF Commands Definition
var IDN = 0x01;
var ProtocolSelect = 0x02;
var SendRecv = 0x04;
var Idle = 0x07;
var RdReg = 0x08;
var WrReg = 0x09;
var BaudRate = 0x0A;
var ECHO  = 0x55;

// RFID Click Connections
/*
sbit SSI_1  at LATA.B2;  // SI1 = DIG = 15 = GPIO22
sbit SSI_0  at LATE.B1; // SI0 = RST = 7 = GPIO4
sbit IRQ_IN at LATC.B0; // IN0 = INT = 11 = GPIO17
sbit CS     at LATE.B0; // CS = CS = 24 = GPIO8
*/

var SSI1_pin = 22;
var SSI0_pin = 4;
var IRQ_IN_pin = 17;
var CS_pin = 8;

// End RFID Click module connections

/*var sdata[18];
var rdata[18];*/

var sdata = new Array();
var rdata = new Array();

var res = 0, dataNum = 0;
var j = 0, tmp = 0;
var ID;

function SPI1_Write(aByte) {
  var buf = new Buffer([aByte]);
  spi.write(buf, function(device, rxbuffer) {
    // ignore rxbuffer for now
    console.log("Wrote value", aByte);
  });
}

function SPI1_read(){
  var readValue;
  spi.read(new Buffer(1), function(device, rxbuffer) {
    readValue = rxbuffer[0];
  });
  console.log("Read value", readValue);
  return readValue;
}

gpio.setup(SSI1_pin, gpio.DIR_OUT);
gpio.setup(SSI0_pin, gpio.DIR_OUT);
gpio.setup(IRQ_IN_pin, gpio.DIR_OUT);
gpio.setup(CS_pin, gpio.DIR_OUT);


function setCS(cs){
  gpio.write(CS_pin, cs);
}

function setIRQ_IN(irq_in){
  gpio.write(IRQ_IN_pin, irq_in);
}

function setSSI_1(ssi_1){
  gpio.write(SSI1_pin, ssi_1);
}

function setSSI_0(ssi_0){
  gpio.write(SSI0_pin, ssi_0)
}

function setLATD_B0(value){

}

// blocking sleep.
function Delay_ms(ms){
  var start = new Date().getTime(), expire = start + ms;
  while (new Date().getTime() < expire) { }
  return;
}

// Write command to the CR95HF
function writeCmd(cmd, dataLen) {
  setCS(0);
  SPI1_Write(0x00);  // Send cmd to CR95HF
  SPI1_Write(cmd);
  SPI1_Write(dataLen); // Hva skjer her?
  while (dataLen == 0){
    setCS(1);
    break;
  }
  for(var i=0; i<dataLen; i++){
    SPI1_Write(sdata[i]);
  }
  setCS(CS);
}

// Poll the CR95HF
function readCmd() {
  while(true){
    console.log("Reading command");
    setCS(0);
    SPI1_Write(0x03);
    res = SPI1_Read();
    setCS(1);

    console.log("Bitwise check", (tmp & 0x08) >> 3);
    if((res & 0x08) >> 3){     // TODO: fiks dette for JS
      console.log("Check successful");
      setCS(0);
      SPI1_Write(0x02);
      res = SPI1_Read();
      dataNum = SPI1_Read();
      
      for(var i=0; i<dataNum; i++) {
        rdata[i] = SPI1_Read();
      }
      setCS(1);
      break;
    }
    setCS(1);
    Delay_ms(10); // TODO: fiks
  }
}

// Calibrate CR95HF device
function Calibration() {

  sdata[0] = 0x03;
  sdata[1] = 0xA1;
  sdata[2] = 0x00;
  sdata[3] = 0xF8;
  sdata[4] = 0x01;
  sdata[5] = 0x18;
  sdata[6] = 0x00;
  sdata[7] = 0x20;
  sdata[8] = 0x60;
  sdata[9] = 0x60;
  sdata[10] = 0x00;
  sdata[11] = 0x00;
  sdata[12] = 0x3F;
  sdata[13] = 0x01;
  writeCmd(Idle, 0x0E);
  readCmd();

  sdata[11] = 0xFC;
  writeCmd(Idle, 0x0E);
  readCmd();

  sdata[11] = 0x7C;
  writeCmd(Idle, 0x0E);
  readCmd();

  sdata[11] = 0x3C;
  writeCmd(Idle, 0x0E);
  readCmd();

  sdata[11] = 0x5C;
  writeCmd(Idle, 0x0E);
  readCmd();

  sdata[11] = 0x6C;
  writeCmd(Idle, 0x0E);
  readCmd();

  sdata[11] = 0x74;
  writeCmd(Idle, 0x0E);
  readCmd();

  sdata[11] = 0x70;
  writeCmd(Idle, 0x0E);
  readCmd();
}

// Select the RF communication protocol (ISO/IEC 14443-A)
function Select_ISO_IEC_14443_A_Protocol() {
  console.log("Running Select_ISO_IEC_14443_A_Protocol");
  sdata[0] = 0x02;
  sdata[1] = 0x00;
  writeCmd(ProtocolSelect, 2);
  readCmd();

  // Clear read and write buffers
  for(var j=0; j<18; j++ ){
    rdata[j] = 0;
    sdata[j] = 0;
  }
}

// Configure IndexMod & Gain
function IndexMod_Gain() {
  console.log("Running IndexMod_Gain");
  sdata[0] = 0x09;
  sdata[1] = 0x04;
  sdata[2] = 0x68;
  sdata[3] = 0x01;
  sdata[4] = 0x01;
  sdata[5] = 0x50;
  writeCmd(WrReg, 6);
  readCmd();
}

// Configure Auto FDet
function AutoFDet() {
  console.log("Running AutoFDet");
  sdata[0] = 0x09;
  sdata[1] = 0x04;
  sdata[2] = 0x0A;
  sdata[3] = 0x01;
  sdata[4] = 0x02;
  sdata[5] = 0xA1;
  writeCmd(WrReg, 6);
  readCmd();
}

// Read the tag ID
function GetNFCTag() {
  console.log("Running GetNFCTag");
  sdata[0] = 0x26;
  sdata[1] = 0x07;
  writeCmd(SendRecv , 2);
  readCmd();

  sdata[0] = 0x93;
  sdata[1] = 0x20;
  sdata[2] = 0x08;
  writeCmd(SendRecv , 3);
  readCmd();

  if(res == 0x80) {
    for( j = 1; j < dataNum - 3; j++) {
      console.log("adding byte ", rdata[j]);
      ID = ID + rdata[j];
      setLATD_B0(1);
    }
    return 1;
  }
  else
  {
    setLATD_B0(0);
    return 0;
  }
}

function initSPI(){
  console.log("Initializing SPI");

  var spiConfig = {
    'mode': SPI.MODE[config.spi.mode],
    'chipSelect': SPI.CS[config.spi.chipSelect],
    'maxSpeed': config.spi.maxSpeed
  };

  spi = new SPI.Spi(
    config.spi.device,
    spiConfig,
    function(s){
      s.open();
      console.log("SPI ready");
    }
  );
}

// Initialize MCU and peripherals
function MCU_Init(){
  console.log("Init MCU");

  // all are outputs
  gpio.setup(SSI1_pin, gpio.DIR_OUT);
  gpio.setup(SSI0_pin, gpio.DIR_OUT);
  gpio.setup(IRQ_IN_pin, gpio.DIR_OUT);
  gpio.setup(CS_pin, gpio.DIR_OUT);

  setIRQ_IN(1);
  setCS(1);

  // Set in SPI mode + Jumper wire workaround required, see header notes
  setSSI_1(0);
  setSSI_0(1);

  // Initialize SPI module
  initSPI();
  console.log("RFid example");
}

// Get Echo reponse from CR95HF
function EchoResponse() {
  console.log("Running echo response");
  setCS(0);
  SPI1_Write(0x00);  // Send cmd to CR95HF
  SPI1_Write(ECHO);
  setCS(1);
  while(1){
    console.log("Waiting for CR95HF to respond");
    setCS(0);
    SPI1_Write(0x03);
    tmp = SPI1_Read();
    setCS(1);

    console.log("bitwise check", (tmp & 0x08) >> 3);
    if((tmp & 0x08) >> 3){ // TODO - sjekk at mulig - sjekker at bit er satt
      console.log("check successful");
      setCS(0);
      SPI1_Write(0x02);
      tmp = SPI1_Read();
      setCS(1);
      if(tmp == ECHO){
        console.log("CR95HF responded");
        return 1;
      }
      return 0;
    }
  }
}

function main() {
  MCU_Init();                           // Initialize MCU and peripherals
  while (!EchoResponse()) {             // Until CR95HF is detected
    setIRQ_IN(0);                         //   put IRQ_IN pin at low level
    Delay_ms(10);
    setIRQ_IN(1);                         //   put IRQ_IN pin at low level
    Delay_ms(10);
  }
  console.log("Calibration...");

  // Configure RFid
  Calibration();
  IndexMod_Gain();
  AutoFDet();
  Select_ISO_IEC_14443_A_Protocol();

  console.log("RFid Ready");
  while(true){
    if(GetNFCTag()){                    // Get tag ID
      console.log("Tag ID: " + ID);
      Delay_ms(500);
    }
    console.log("recheck");
  }
}

main();