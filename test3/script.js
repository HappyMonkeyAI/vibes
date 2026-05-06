// Sudoku Puzzle Generator

const CLUE_COUNT = 35; // Number of given clues

/**
 * Generate a valid, complete 9x9 Sudoku board using backtracking.
 */
function generateCompleteBoard() {
    const board = Array.from({ length: 9 }, () => Array(9).fill(0));

    // Fill the three diagonal 3x3 boxes first (they are independent)
    fillDiagonalBoxes(board);

    // Use backtracking to fill remaining cells
    solveBoard(board, 0, 0);

    return board;
}

/**
 * Fill each of the three diagonal 3x3 sub-grids with random values.
 */
function fillDiagonalBoxes(board) {
    for (let box = 0; box < 3; box++) {
        const startRow = box * 3;
        const startCol = box * 3;

        const numbers = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
        let idx = 0;

        for (let r = 0; r < 3; r++) {
            for (let c = 0; c < 3; c++) {
                board[startRow + r][startCol + c] = numbers[idx++];
            }
        }
    }
}

/**
 * Shuffle an array in place using Fisher-Yates algorithm.
 */
function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

/**
 * Recursively solve the board using backtracking.
 */
function solveBoard(board, row, col) {
    // Move to next cell
    if (col === 9) {
        col = 0;
        row++;
        if (row === 9) return true; // Board is complete
    }

    // Skip filled cells
    if (board[row][col] !== 0) {
        return solveBoard(board, row, col + 1);
    }

    // Try each number 1-9 in random order
    const candidates = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    for (const num of candidates) {
        if (isValid(board, row, col, num)) {
            board[row][col] = num;

            if (solveBoard(board, row, col + 1)) return true;

            board[row][col] = 0; // Backtrack
        }
    }

    return false;
}

/**
 * Check if placing num at board[row][col] is valid.
 */
function isValid(board, row, col, num) {
    // Check row
    for (let c = 0; c < 9; c++) {
        if (board[row][c] === num) return false;
    }

    // Check column
    for (let r = 0; r < 9; r++) {
        if (board[r][col] === num) return false;
    }

    // Check 3x3 sub-grid
    const startRow = Math.floor(row / 3) * 3;
    const startCol = Math.floor(col / 3) * 3;
    for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
            if (board[startRow + r][startCol + c] === num) return false;
        }
    }

    return true;
}

/**
 * Remove cells from a complete board to create a puzzle.
 * Returns the puzzle board with 0 for empty cells.
 */
function removeCells(board, count) {
    const puzzle = board.map(row => [...row]);
    let removed = 0;

    while (removed < count) {
        const r = Math.floor(Math.random() * 9);
        const c = Math.floor(Math.random() * 9);

        if (puzzle[r][c] !== 0) {
            puzzle[r][c] = 0;
            removed++;
        }
    }

    return puzzle;
}

/**
 * Create a playable puzzle: generate complete board, then remove cells.
 */
function createPuzzle() {
    const completeBoard = generateCompleteBoard();
    const puzzle = removeCells(completeBoard, 81 - CLUE_COUNT);
    return { puzzle, solution: completeBoard };
}

/**
 * Render the puzzle to the DOM grid.
 * Fixed clues are non-editable; empty cells are editable inputs.
 */
function renderPuzzle(puzzle) {
    const boardEl = document.getElementById('board');
    boardEl.innerHTML = '';

    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            const cell = document.createElement('input');
            cell.type = 'text';
            cell.className = 'cell';
            cell.maxLength = 1;
            cell.dataset.row = r;
            cell.dataset.col = c;

            if (puzzle[r][c] !== 0) {
                // Fixed clue: non-editable
                cell.value = puzzle[r][c];
                cell.readOnly = true;
                cell.classList.add('clue');
            } else {
                // Empty cell: editable, accept only digits 1-9
                cell.value = '';
                cell.addEventListener('input', function () {
                    this.value = this.value.replace(/[^1-9]/g, '');
                });
            }

            boardEl.appendChild(cell);
        }
    }
}

// Initialize game on load
document.addEventListener('DOMContentLoaded', () => {
    const { puzzle } = createPuzzle();
    renderPuzzle(puzzle);
});
