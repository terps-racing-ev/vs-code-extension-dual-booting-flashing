ENTRY(Reset_Handler)
_estack = ORIGIN(RAM) + LENGTH(RAM);
_Min_Heap_Size = 0x200;
_Min_Stack_Size = 0x400;

MEMORY
{
RAM (xrw)      : ORIGIN = 0x20000000, LENGTH = 48K
RAM2 (xrw)      : ORIGIN = 0x10000000, LENGTH = 16K
  FLASH (rx)      : ORIGIN = 0x08008000, LENGTH = 104K   /* App Bank A — managed by stm32-trev */
  STORAGE (r)      : ORIGIN = 0x0803C000, LENGTH = 16K   /* Permanent storage — managed by stm32-trev */
}

SECTIONS
{
  .isr_vector : { . = ALIGN(8); KEEP(*(.isr_vector)) . = ALIGN(8); } >FLASH
  .text : { *(.text) } >FLASH
}
