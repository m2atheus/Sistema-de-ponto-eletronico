const CICLOS = {
  ciclo_24x72: { trabalhoMinutos: 24 * 60, periodoMinutos: 96 * 60 },
  ciclo_12x36: { trabalhoMinutos: 12 * 60, periodoMinutos: 48 * 60 },
};

function minutosDoHorario(horario) {
  if (typeof horario !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(horario)) return null;
  const [hora, minuto] = horario.split(":").map(Number);
  return hora * 60 + minuto;
}

function duracaoTurnoMinutos(horaInicio, horaFim) {
  const inicio = minutosDoHorario(horaInicio);
  const fim = minutosDoHorario(horaFim);
  if (inicio === null || fim === null) return null;
  return (fim - inicio + 24 * 60) % (24 * 60) || 24 * 60;
}

function expandirTurnos(turnos) {
  if (!Array.isArray(turnos)) return [];
  return turnos.flatMap((turno) => {
    const dias = Array.isArray(turno.diasSemana)
      ? turno.diasSemana
      : turno.diaSemana == null
        ? [null]
        : [turno.diaSemana];
    return dias.map((diaSemana) => ({ ...turno, diaSemana }));
  });
}

function validarTurnos(modelo, turnos) {
  const expandidos = expandirTurnos(turnos);
  if (!expandidos.length) return "Informe pelo menos um turno.";

  if (CICLOS[modelo]) {
    if (expandidos.length !== 1 || expandidos[0].diaSemana != null) {
      return "Escalas cíclicas devem ter um único turno sem dia da semana.";
    }
    const duracao = duracaoTurnoMinutos(expandidos[0].horaInicio, expandidos[0].horaFim);
    if (duracao !== CICLOS[modelo].trabalhoMinutos) return "A duração do turno não corresponde ao ciclo selecionado.";
  } else {
    if (expandidos.some((turno) => !Number.isInteger(turno.diaSemana) || turno.diaSemana < 1 || turno.diaSemana > 7)) {
      return "Cada turno semanal precisa de um dia da semana entre 1 (segunda) e 7 (domingo).";
    }
    if (modelo === "comercial_5x2") {
      if (expandidos.some((turno) => turno.diaSemana > 5)) {
        return "A escala comercial 5x2 aceita turnos somente de segunda a sexta.";
      }
      const diasConfigurados = new Set(expandidos.map((turno) => turno.diaSemana));
      if (diasConfigurados.size !== 5) return "A escala comercial 5x2 precisa cobrir de segunda a sexta.";
    }
  }

  for (const turno of expandidos) {
    const duracao = duracaoTurnoMinutos(turno.horaInicio, turno.horaFim);
    if (duracao === null) return "Horário inválido. Use o formato HH:mm.";
    if (!Number.isInteger(turno.intervaloMinutos) || turno.intervaloMinutos < 0 || turno.intervaloMinutos >= duracao) {
      return "O intervalo deve ser maior ou igual a zero e menor que a duração do turno.";
    }
  }
  return null;
}

function dataUtc(valor) {
  if (typeof valor !== "string" && !(valor instanceof Date)) return null;
  const entrada = valor instanceof Date ? valor.toISOString() : valor;
  const data = /^\d{4}-\d{2}-\d{2}$/.test(entrada)
    ? new Date(`${entrada}T00:00:00.000Z`)
    : new Date(entrada);
  return Number.isFinite(data.getTime()) ? data : null;
}

function somarMinutos(data, minutos) {
  return new Date(data.getTime() + minutos * 60 * 1000);
}

function horarioIso(data) {
  return data.toISOString();
}

function projetarEscala({ modelo, dataReferencia, dataInicio, dias, turnos }) {
  const inicio = dataUtc(dataInicio);
  if (!inicio || !Number.isInteger(dias) || dias < 1 || dias > 365) {
    throw new Error("Informe data de início válida e horizonte entre 1 e 365 dias.");
  }
  const expandidos = expandirTurnos(turnos);
  if (CICLOS[modelo]) {
    const referencia = dataUtc(dataReferencia);
    if (!referencia || expandidos.length !== 1) throw new Error("Escala cíclica precisa de data de referência e um turno.");
    const ciclo = CICLOS[modelo];
    const ancora = somarMinutos(referencia, minutosDoHorario(expandidos[0].horaInicio));
    return Array.from({ length: dias }, (_, indice) => {
      const dia = somarMinutos(inicio, indice * 24 * 60);
      const proximoDia = somarMinutos(dia, 24 * 60);
      const inicioCiclo = Math.floor((dia.getTime() - ancora.getTime()) / (ciclo.periodoMinutos * 60 * 1000)) - 1;
      const turnosDoDia = [];
      for (let cicloIndex = inicioCiclo; ; cicloIndex += 1) {
        const turnoInicio = somarMinutos(ancora, cicloIndex * ciclo.periodoMinutos);
        if (turnoInicio >= proximoDia) break;
        const turnoFim = somarMinutos(turnoInicio, ciclo.trabalhoMinutos);
        if (turnoFim > dia) turnosDoDia.push({ inicio: horarioIso(turnoInicio), fim: horarioIso(turnoFim) });
      }
      return { data: dia.toISOString().slice(0, 10), trabalha: turnosDoDia.length > 0, turnos: turnosDoDia };
    });
  }

  return Array.from({ length: dias }, (_, indice) => {
    const dia = somarMinutos(inicio, indice * 24 * 60);
    const diaSemana = dia.getUTCDay() || 7;
    const turnosDoDia = expandidos
      .filter((turno) => turno.diaSemana === diaSemana)
      .map((turno) => {
        const turnoInicio = somarMinutos(dia, minutosDoHorario(turno.horaInicio));
        const duracao = duracaoTurnoMinutos(turno.horaInicio, turno.horaFim);
        const turnoFim = somarMinutos(turnoInicio, duracao);
        return { inicio: horarioIso(turnoInicio), fim: horarioIso(turnoFim) };
      });
    return { data: dia.toISOString().slice(0, 10), trabalha: turnosDoDia.length > 0, turnos: turnosDoDia };
  });
}

module.exports = {
  CICLOS,
  minutosDoHorario,
  duracaoTurnoMinutos,
  expandirTurnos,
  validarTurnos,
  projetarEscala,
};