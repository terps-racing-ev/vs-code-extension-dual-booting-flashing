extern unsigned _estack;
void Reset_Handler(void) { for (;;) { } }
__attribute__((section(".isr_vector"), used))
void (* const g_vt[])(void) = { (void (*)(void)) &_estack, Reset_Handler };
