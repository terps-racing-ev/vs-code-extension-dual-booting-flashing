ENTRY(Reset_Handler)
_estack = ORIGIN(RAM) + LENGTH(RAM);
_Min_Heap_Size = 0x200;
_Min_Stack_Size = 0x400;

MEMORY
{
RAM (xrw)      : ORIGIN = 0x20000000, LENGTH = 48K
RAM2 (xrw)      : ORIGIN = 0x10000000, LENGTH = 16K
FLASH (rx)      : ORIGIN = 0x8000000, LENGTH = 256K
}

SECTIONS
{
  .isr_vector : { . = ALIGN(8); KEEP(*(.isr_vector)) . = ALIGN(8); } >FLASH
  .text : { *(.text) } >FLASH
}
