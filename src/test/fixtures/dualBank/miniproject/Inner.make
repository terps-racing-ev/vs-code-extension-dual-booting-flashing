TARGET ?= app
BUILD_DIRECTORY ?= build
LDSCRIPT ?= link.ld
C_DEFS ?=
# Mirrors the real STM32Make.make template (CreateMakefile.ts): the PATH-only `CC ?=`
# fallback is a known GNU Make gotcha (the built-in default for CC beats `?=`), so callers
# must pass ARM_GCC_PATH on the command line, same as production runBuild() does.
ifdef ARM_GCC_PATH
    CC = $(ARM_GCC_PATH)/arm-none-eabi-gcc
else
    CC ?= arm-none-eabi-gcc
endif
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
