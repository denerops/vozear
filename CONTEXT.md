# Vozear

A rotina semanal de uma escola de música pequena: quem estuda, com quem, em qual horário, e se a mensalidade daquele instrumento está em aberto.

## Language

**Aluno**:
Pessoa matriculada que entra no app com a própria conta.
_Avoid_: responsável, cliente

**Professor**:
Pessoa que leciona um ou mais instrumentos e conduz as próprias aulas.
_Avoid_: instrutor

**Administrador**:
Pessoa da escola que cadastra pessoas, preços, agenda e mensalidades. Pode ser também professor.
_Avoid_: secretaria, gestor

**Instrumento**:
O que se estuda na matrícula. Canto, pandeiro, percussão, violão e piano são instrumentos da escola.
_Avoid_: curso, turma

**Horário**:
Disponibilidade semanal de um professor, com dia, início e duração. Cabe uma matrícula ativa.
_Avoid_: slot, grade, turma

**Matrícula**:
O vínculo de um aluno, um instrumento, um professor, um horário e um valor mensal.
_Avoid_: pacote, crédito de horas

**Aula**:
Uma ocorrência da matrícula, numa data. Pode ser prevista, realizada, falta, cancelada ou remarcada.
_Avoid_: encontro, sessão

**Recado**:
Texto e links deixados pelo professor numa aula, visíveis para o aluno daquela aula.
_Avoid_: chat, mensagem, material

**Mensalidade**:
Cobrança de um mês de uma matrícula. O valor não muda com a quantidade de aulas do mês.
_Avoid_: fatura, boleto, parcela

**Pix estático**:
Código copia-e-cola, com valor, gerado pela escola. Não avisa quando o pagamento cai.
_Avoid_: link de pagamento, checkout
