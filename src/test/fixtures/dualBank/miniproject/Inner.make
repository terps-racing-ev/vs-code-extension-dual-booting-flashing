TARGET ?= app
BUILD_DIRECTORY ?= build
LDSCRIPT ?= link.ld
C_DEFS ?=
CC ?= arm-none-eabi-gcc
REL := $(BUILD_DIRECTORY)/debug
MCU := -mcpu=cortex-m4 -mthumb
all: $(REL)/$(TARGET).elf $(REL)/$(TARGET).bin $(REL)/$(TARGET).hex
$(REL)/$(TARGET).elf: main.c startup_min.s $(LDSCRIPT)
	mkdir -p $(REL)
	$(CC) $(MCU) $(C_DEFS) -nostdlib -T$(LDSCRIPT) main.c startup_min.s -o $@
$(REL)/$(TARGET).bin: $(REL)/$(TARGET).elf
	arm-none-eabi-objcopy -O binary $< $@
$(REL)/$(TARGET).hex: $(REL)/$(TARGET).elf
	arm-none-eabi-objcopy -O ihex $< $@
