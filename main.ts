const nbSimulations = 1_000_000;
const nbDeck = 8;
const listOfCardValues = [
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "10",
    "J",
    "Q",
    "K",
    "A",
];
const listOfCardSymbols = ["♠", "♡", "♦", "♣"];
import cliProgress from "npm:cli-progress";

enum DecisionEnum {
    Hit,
    Stand,
    Double,
    Split,
}

class Card {
    value: string;
    symbol: string;
    public constructor(value: string, symbol: string) {
        this.value = value;
        this.symbol = symbol;
    }
}

class Deck {
    cards: Card[];
    totalCard: number;
    remainingCard: number;
    public constructor() {
        const cards: Card[] = [];
        for (let i = 0; i < nbDeck; i++) {
            for (const v of listOfCardValues) {
                for (const s of listOfCardSymbols) {
                    cards.push(new Card(v, s));
                }
            }
        }
        this.cards = cards;
        this.totalCard = cards.length;
        this.remainingCard = cards.length;
    }

    // https://stackoverflow.com/a/2450976/6824121
    shuffle() {
        let currentIndex = this.cards.length;
        while (currentIndex != 0) {
            const randomIndex = Math.floor(Math.random() * currentIndex);
            currentIndex--;
            [this.cards[currentIndex], this.cards[randomIndex]] = [
                this.cards[randomIndex],
                this.cards[currentIndex],
            ];
        }
    }

    drawCard(index: number | null = null): Card {
        if (index === null) {
            index = this.cards.length - 1;
        }
        const result = this.cards[index];
        this.cards.splice(index, 1);
        return result;
    }

    putBackCard(cards: Card[]) {
        this.cards = [...this.cards, ...cards];
    }
}

class Player {
    cards: Card[];
    betAmount: number;
    isSplit: boolean;
    public constructor(cards: Card[], isSplit: boolean = false) {
        this.cards = cards;
        this.betAmount = 2;
        this.isSplit = isSplit;
    }
}

class Game {
    players: Player[];
    dealerCards: Card[];
    deck: Deck;
    win: number;
    nbWin: number;
    winAmount: number;
    nbLoss: number;
    lossAmount: number;
    nbTie: number;

    public constructor(deck: Deck) {
        this.win = 0;
        this.nbWin = 0;
        this.nbLoss = 0;
        this.nbTie = 0;
        this.winAmount = 0;
        this.lossAmount = 0;
        this.deck = deck;
        this.players = [];
        this.dealerCards = [];
        const bar1 = new cliProgress.SingleBar(
            {},
            cliProgress.Presets.shades_classic,
        );
        const split: any = {};
        bar1.start(nbSimulations, 0);
        for (let i = 0; i < nbSimulations; i++) {
            this.deck.shuffle();
            const thisWin = this.play();
            if (split[this.players.length] === undefined) {
                split[this.players.length] = {
                    nbTie: 0,
                    nbWin: 0,
                    nbLoss: 0,
                    winAmount: 0,
                    lossAmount: 0,
                };
            }
            if (thisWin === 0) {
                this.nbTie++;
                split[this.players.length].nbTie++;
            } else if (thisWin > 0) {
                this.nbWin++;
                split[this.players.length].nbWin++;
                split[this.players.length].winAmount += thisWin;
                this.winAmount += thisWin;
            } else {
                this.nbLoss++;
                split[this.players.length].nbLoss++;
                split[this.players.length].lossAmount += thisWin;
                this.lossAmount += thisWin;
            }
            this.win += thisWin;
            for (const player of this.players) {
                this.deck.putBackCard(player.cards);
            }
            this.deck.putBackCard(this.dealerCards);
            bar1.update(i);
        }
        bar1.stop();
        for (const key in split) {
            const nbWin = split[key].winAmount + split[key].lossAmount;
            split[key].avWinByHand = (nbWin / nbSimulations) * 100 + "%";
            split[key].avgWinLoose = nbWin / (split[key].nbLoss + nbWin);
            split[key].avgWinAmount = split[key].winAmount / nbWin;
            split[key].avgLossAmount = split[key].lossAmount /
                split[key].nbLoss;
        }
        console.log({
            avWinByHand: (this.win / nbSimulations) * 100 + "%",
            nbTie: this.nbTie,
            nbWin: this.nbWin,
            avgWin: this.nbWin / (this.nbLoss + this.nbWin),
            avgWinAmount: this.winAmount / this.nbWin,
            nbLoss: this.nbLoss,
            avgLossAmount: this.lossAmount / this.nbLoss,
            split: split,
        });
    }

    play(): number {
        this.players = [
            new Player([this.deck.drawCard(), this.deck.drawCard()]),
        ];

        this.dealerCards = [this.deck.drawCard(), this.deck.drawCard()];
        let indexPlayer = 0;
        while (indexPlayer < this.players.length) {
            this.playerTurn(this.players[indexPlayer]);
            indexPlayer++;
        }
        this.dealerTurn();
        let result = 0;
        for (const player of this.players) {
            result += this.determineWinner(player);
        }
        if (this.players.length > 1 && result > 0) {
            // console.log(this.players);
            // console.log(this.dealerCards);
            // console.log(result);
            // console.log("=============================");
            // console.log("=============================");
            // console.log("=============================");
        }
        return result;
    }

    determineWinner(player: Player): number {
        const blackJackResult = this.resolveBlackjack(
            player,
            this.dealerCards,
        );
        if (blackJackResult !== null) {
            return blackJackResult;
        }
        const valuePlayer = this.getValue(player.cards);
        if (valuePlayer === null) {
            return -player.betAmount;
        }
        const valueDealer = this.getValue(this.dealerCards);
        if (valueDealer === null) {
            return player.betAmount;
        }
        const realValuePlayer = valuePlayer[valuePlayer.length - 1];
        const realValueDealer = valueDealer[valueDealer.length - 1];
        if (realValuePlayer === realValueDealer) {
            return 0;
        }
        if (realValuePlayer > realValueDealer) {
            return player.betAmount;
        }
        return -player.betAmount;
    }

    getDecision(player: Player, dealerCards: Card[]): DecisionEnum {
        const valuePlayer = this.getValue(player.cards);
        const valueDealer = this.getValue([dealerCards[0]])![0];
        if (
            valuePlayer === null ||
            player.isSplit && player.cards[0].value === "A"
        ) {
            return DecisionEnum.Stand;
        }
        const realValuePlayer = valuePlayer[valuePlayer.length - 1];
        const isPair = player.cards.length === 2 &&
            player.cards[0].value === player.cards[1].value;
        if (isPair && !player.isSplit) {
            if (
                player.cards[0].value === "A" ||
                player.cards[0].value === "8"
            ) {
                return DecisionEnum.Split;
            } else if (player.cards[0].value === "9") {
                if ([7, 10, 1].includes(valueDealer)) {
                    return DecisionEnum.Stand;
                }
                return DecisionEnum.Split;
            } else if (player.cards[0].value === "7") {
                if ([9, 10, 1].includes(valueDealer)) {
                    return DecisionEnum.Hit;
                }
                return DecisionEnum.Split;
            } else if (player.cards[0].value === "6") {
                if ([8, 9, 10, 1].includes(valueDealer)) {
                    return DecisionEnum.Hit;
                }
                return DecisionEnum.Split;
            } else if (player.cards[0].value === "4") {
                if ([2, 3, 4, 7, 8, 9, 10, 1].includes(valueDealer)) {
                    return DecisionEnum.Hit;
                }
                return DecisionEnum.Split;
            } else if (
                player.cards[0].value === "3" ||
                player.cards[0].value === "2"
            ) {
                if ([8, 9, 10, 1].includes(valueDealer)) {
                    return DecisionEnum.Hit;
                }
                return DecisionEnum.Split;
            }
        }
        const isSoft = valuePlayer.length === 2;
        if (isSoft) {
            if (
                realValuePlayer === 13 ||
                realValuePlayer === 14
            ) {
                if ([5, 6].includes(valueDealer)) {
                    return DecisionEnum.Double;
                }
                return DecisionEnum.Hit;
            } else if (
                realValuePlayer === 15 ||
                realValuePlayer === 16
            ) {
                if ([4, 5, 6].includes(valueDealer)) {
                    return DecisionEnum.Double;
                }
                return DecisionEnum.Hit;
            } else if (realValuePlayer === 17) {
                if ([3, 4, 5, 6].includes(valueDealer)) {
                    return DecisionEnum.Double;
                }
                return DecisionEnum.Hit;
            } else if (realValuePlayer === 18) {
                if ([3, 4, 5, 6].includes(valueDealer)) {
                    return DecisionEnum.Double;
                }
                if ([2, 7, 8].includes(valueDealer)) {
                    return DecisionEnum.Stand;
                }
                return DecisionEnum.Hit;
            }
            return DecisionEnum.Stand;
        }
        if (realValuePlayer <= 8) {
            return DecisionEnum.Hit;
        } else if (realValuePlayer === 9) {
            if ([2, 3, 4, 5, 6].includes(valueDealer)) {
                return DecisionEnum.Double;
            }
            return DecisionEnum.Hit;
        } else if (realValuePlayer === 10) {
            if ([2, 3, 4, 5, 6, 7, 8, 9].includes(valueDealer)) {
                return DecisionEnum.Double;
            }
            return DecisionEnum.Hit;
        } else if (realValuePlayer === 11) {
            return DecisionEnum.Double;
        } else if (realValuePlayer === 12) {
            if ([4, 5, 6].includes(valueDealer)) {
                return DecisionEnum.Stand;
            }
            return DecisionEnum.Hit;
        } else if (realValuePlayer >= 13 && realValuePlayer <= 16) {
            if ([2, 3, 4, 5, 6].includes(valueDealer)) {
                return DecisionEnum.Stand;
            }
            return DecisionEnum.Hit;
        }
        return DecisionEnum.Stand;
    }

    dealerTurn() {
        while (true) {
            const valueDealer = this.getValue(this.dealerCards);
            if (valueDealer === null) {
                return;
            }
            const realValueDealer = valueDealer[valueDealer.length - 1];
            if (realValueDealer >= 17) {
                return;
            }
            this.dealerCards.push(this.deck.drawCard());
        }
    }

    playerTurn(player: Player) {
        // Resolve any initial Blackjack scenario
        const initialResult = this.resolveBlackjack(
            player,
            this.dealerCards,
        );
        if (initialResult !== null) {
            return;
        }

        while (true) {
            const decision = this.getDecision(player, this.dealerCards);
            if (decision === DecisionEnum.Stand) {
                return;
            } else if (decision === DecisionEnum.Hit) {
                player.cards.push(this.deck.drawCard());
            } else if (decision === DecisionEnum.Double) {
                player.cards.push(this.deck.drawCard());
                player.betAmount = player.betAmount * 2;
                return;
            } else if (decision === DecisionEnum.Split) {
                this.players.push(
                    new Player([
                        player.cards[player.cards.length - 1],
                        this.deck.drawCard(),
                    ], true),
                );
                this.players[this.players.length - 1].betAmount =
                    player.betAmount;
                player.cards.pop();
                player.cards.push(this.deck.drawCard());
                player.isSplit = true;
            }
            const blackJackResult = this.resolveBlackjack(
                player,
                this.dealerCards,
            );
            if (blackJackResult !== null) {
                return;
            }
        }
    }

    getValue(cards: Card[]): number[] | null {
        let possibleValues: Set<number> = new Set([0]); // Start with one possible total: 0

        for (const card of cards) {
            const newValues: Set<number> = new Set();
            if (card.value === "A") {
                // Aces can be 1 or 11, so add both possibilities to each current total
                for (const val of possibleValues) {
                    newValues.add(val + 1); // Ace as 1
                    newValues.add(val + 11); // Ace as 11
                }
            } else if (["J", "Q", "K"].includes(card.value)) {
                // Face cards are worth 10
                for (const val of possibleValues) {
                    newValues.add(val + 10);
                }
            } else {
                // Number cards are worth their face value
                const cardValue = parseInt(card.value);
                for (const val of possibleValues) {
                    newValues.add(val + cardValue);
                }
            }
            possibleValues = newValues;
        }

        const validValues = Array.from(possibleValues).filter((value) =>
            value <= 21
        );

        if (validValues.length > 0) {
            return validValues.sort((a, b) => a - b);
        }
        return null;
    }

    isBlackjack(cards: Card[]): boolean {
        const values = this.getValue(cards);
        if (values === null) {
            return false;
        }
        return values.includes(21) && cards.length === 2;
    }

    resolveBlackjack(player: Player, dealerCards: Card[]): number | null {
        const playerBlackjack = this.isBlackjack(player.cards);
        const dealerBlackjack = this.isBlackjack(dealerCards);

        if (playerBlackjack && dealerBlackjack) {
            return 0;
        } else if (playerBlackjack) {
            return player.betAmount * 1.5;
        } else if (dealerBlackjack) {
            return -player.betAmount;
        }
        return null;
    }
}

const deck = new Deck();
let nbCardRemoved = 0;
let i = 0;
for (const card of deck.cards) {
    if (
        card.symbol === "2" ||
        card.symbol === "3" ||
        card.symbol === "4" ||
        card.symbol === "5"
    ) {
        deck.drawCard(i);
        nbCardRemoved++;
    }
    if (nbCardRemoved >= 300) {
        break;
    }
    i++;
}
const game = new Game(deck);
// remove just 4 cards from the deck after multiple plays
for (let i = 0; i < 4; i++) {
    deck.drawCard();
}
