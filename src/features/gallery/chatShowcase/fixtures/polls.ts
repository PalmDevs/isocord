import { Day, sequence } from './build'
import { BOB, CARA } from './world'
import type { ApiPoll } from '../../../chat/rows/rich'

/** Far enough ahead that the polls stay open. */
const OPEN_UNTIL = '2099-01-01T00:00:00.000Z'

const answers = (...texts: string[]): ApiPoll['answers'] =>
    texts.map((text, index) => ({
        answer_id: index + 1,
        poll_media: { text },
    }))

export const pollMessages = sequence(Day.POLLS, [
    {
        author: BOB,
        content: '',
        poll: {
            question: { text: 'Tea or coffee?' },
            answers: answers('Tea', 'Coffee', 'Neither'),
            expiry: OPEN_UNTIL,
        },
    },
    {
        author: BOB,
        content: 'Multiple answers, with emoji.',
        poll: {
            question: { text: 'Which days work?' },
            allow_multiselect: true,
            expiry: OPEN_UNTIL,
            answers: [
                {
                    answer_id: 1,
                    poll_media: {
                        text: 'Saturday',
                        emoji: { name: '\u{1F31E}' },
                    },
                },
                {
                    answer_id: 2,
                    poll_media: {
                        text: 'Sunday',
                        emoji: { name: '\u{1F319}' },
                    },
                },
            ],
        },
    },
    {
        gapMinutes: 8,
        author: CARA,
        content: 'You voted, so the results show.',
        poll: {
            question: { text: 'Best editor?' },
            answers: answers('Vim', 'Emacs', 'Code'),
            expiry: OPEN_UNTIL,
            results: {
                is_finalized: false,
                answer_counts: [
                    { id: 1, count: 5, me_voted: false },
                    { id: 2, count: 2, me_voted: true },
                    { id: 3, count: 8, me_voted: false },
                ],
            },
        },
    },
    {
        author: BOB,
        content: 'Several answers allowed, and you voted for two.',
        poll: {
            question: { text: 'Which snacks?' },
            allow_multiselect: true,
            expiry: OPEN_UNTIL,
            answers: answers('Chips', 'Fruit', 'Cookies'),
            results: {
                is_finalized: false,
                answer_counts: [
                    { id: 1, count: 3, me_voted: true },
                    { id: 2, count: 1, me_voted: false },
                    { id: 3, count: 4, me_voted: true },
                ],
            },
        },
    },
    {
        author: CARA,
        content: 'An ended poll you voted in: your answer won.',
        poll: {
            question: { text: 'Movie night?' },
            answers: answers('Friday', 'Saturday'),
            expiry: '2026-03-08T12:00:00.000Z',
            results: {
                is_finalized: true,
                answer_counts: [
                    { id: 1, count: 6, me_voted: true },
                    { id: 2, count: 2, me_voted: false },
                ],
            },
        },
    },
    {
        author: CARA,
        content: 'A poll that has ended.',
        poll: {
            question: { text: 'Pizza topping?' },
            answers: answers('Pineapple', 'Mushroom'),
            expiry: '2026-03-08T12:00:00.000Z',
            results: {
                is_finalized: true,
                answer_counts: [
                    { id: 1, count: 1, me_voted: false },
                    { id: 2, count: 11, me_voted: false },
                ],
            },
        },
    },
])
