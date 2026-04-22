#!/usr/bin/env ruby
# frozen_string_literal: true
require 'yaml'

# G00 	Polohovanie rýchloposuvom 	01
# G01 	Pohyb s lineárnou interpoláciou 	01
# G02 	Pohyb s kruhovou interpoláciou CW (v smere hodinových ručičiek) 	01
# G03 	Pohyb s kruhovou interpoláciou CCW (proti smeru hodinových ručičiek)
# G90 	Príkaz absolútnej polohy 	03
# G91 	Príkaz inkrementálneho polohovania 	03

class Zubok
  def initialize(ymnl)
    @filename = ymnl
  end

  def loadconfig
    puts 'Loading config... ' + @filename
    @config = YAML.load_file(@filename)
    puts @config
    @tloustka_prkna = @config['tloustka_prkna'].to_f || 18
    @sirka_prkna = @config['sirka_prkna'].to_f || 120
    @pocet_zubu = @config['pocet_zubu'].to_f || 6
    @sirka_zubku = @sirka_prkna / @pocet_zubu
    @hloubka_zubu = @config['hloubka_zubu'].to_f || 10
    freza = @config['freza'].to_f || 4.0
    @d = freza
    @r = freza / 2

    @krok_vnoreni = @config['krok_vnoreni'].to_f || 1.0

    @drveni = @config['drveni'].to_f || 0.1

    puts "Sirka zubku: #{@sirka_zubku}"
    @fn = sanitize_filename @config['nazev']

  end
  def sanitize_filename(filename)
    filename.tr(
      "áäčďéěíľĺňóôöőřšťúüűýžÁÄČĎÉĚÍĽĹŇÓÔÖŐŘŠŤÚÜŰÝŽ",
      "aacdeeillnoooorstuuuyzAACDEEILLNOOOORSTUUUYZ"
    ).gsub(/\s+/, "_")
  end

  def wr(s='')
    puts "> #{s}"
    @file.puts s
  end

  def zubok(x=0)
    if @zacatek
      @leve_drveni = 0
    else
      @leve_drveni = @drveni
    end

    wr "G00 X#{x + @d + @leve_drveni} Y0 Z4"
    z = -@krok_vnoreni
    while z > -1*@hloubka_zubu do

      vrstva(x,z)
      z -= @krok_vnoreni
    end
    if z < -1*@hloubka_zubu
      vrstva(x, -1*@hloubka_zubu )
    end

    wr "G00 Z4"
    wr "(-------------------)"

  end

  def vrstva(x,z)
    spirala = 0
    wr " (vrstva #{z})"
    wr "G01 Z#{z}"

    d = @d
    drv = @drveni

    if @sirka_zubku < 2*@d
      wr "G01 Y#{@tloustka_prkna + @r}"
      wr "G01 X#{x + @sirka_zubku - drv}"
      wr "G01 Y#{@r}"
      wr "G01 X#{x + @d + @leve_drveni} Y0"
    else
      while (d + d * spirala) < @sirka_zubku/2 do
        wr "G01 Y#{@tloustka_prkna - d*spirala + @r}"
        wr "G01 X#{x + @sirka_zubku -  d * spirala - drv}"
        wr "G01 Y#{d*spirala + @r}"
        spirala +=1
        d = @d - 0.1
        wr "G01 X#{x + d + d * spirala}   (spiral #{spirala}end)"
        drv = 0
      end
      wr "G01 Y#{@tloustka_prkna - @d*spirala + @d}"
      wr "G01 X#{x + @d + @leve_drveni} Y0"

    end



  end



  def hi
    loadconfig

    puts "Filename: #{@fn}"
    @file = File.open("#{@fn}_a.nc", 'w')
    generovat 0
    @file = File.open("#{@fn}_b.nc", 'w')
    generovat @sirka_zubku
  end

  def generovat(ofs=0)
    @zacatek = true
    n = 0
    wr "(zubok #{@fn})\n(sirka zubu #{@sirka_zubku})\n(tloustka prkna #{@tloustka_prkna})
(pocet zubu #{@pocet_zubu})
(hloubka zubu #{@hloubka_zubu})
(freza #{@d})
(krok vnoreni #{@krok_vnoreni})"

    wr "G90"
    wr "M03 S24000 F300     (spuštění pravých otáček vřetene)"

    while true do
      zubok n*@sirka_zubku+ofs
      @zacatek = false
      n += 2
      break if (n*@sirka_zubku+ofs) >= @sirka_prkna
    end

    wr "G00 Z4"
    wr "G00 X0 Y0"
    wr "M05   (zastaveni frezy)"
    #    wr "G00 Z0"
    wr "M30   (konec programu)"

    @file.close

  end
end


# v konstruktoru se predda nazev yml souboru a vytvori se instance tridy
Zubok.new(ARGV[0] || 'zubok.yml').hi